/**
 * /agendar/$slug — auto-agendamento sem login (Fatia 4a).
 *
 * Só quem já está cadastrado agenda: a pessoa informa o e-mail, a página
 * confere contra `people` daquela conta, e só então mostra os horários. Ver
 * docs/plano-mentorias-fatia4.md — a segurança está no slug secreto, não em
 * esconder quem está cadastrado, por isso a recusa por e-mail é clara.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dadosDoLink, verificarEmailAgendamento, horariosLivresAgendamento, confirmarAgendamento } from "@/lib/agendamento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CalendarCheck, Clock, Mail } from "lucide-react";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-xl bg-card p-8 ring-1 ring-black/5">{children}</div>
    </div>
  );
}

function diaBrExtenso(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const texto = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function horaBr(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

type Dia = { data: string; horarios: string[] };

export function AgendarPage({ slug }: { slug: string }) {
  const dadosFn = useServerFn(dadosDoLink);
  const verificarFn = useServerFn(verificarEmailAgendamento);
  const horariosFn = useServerFn(horariosLivresAgendamento);
  const confirmarFn = useServerFn(confirmarAgendamento);

  const { data: link, isLoading: carregandoLink } = useQuery({
    queryKey: ["agendar-dados-link", slug],
    queryFn: () => dadosFn({ data: { slug } }),
  });

  const [email, setEmail] = useState("");
  const [emailConfirmado, setEmailConfirmado] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [recusa, setRecusa] = useState<string | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<{ quando: string } | null>(null);

  const verificar = useMutation({
    mutationFn: () => verificarFn({ data: { slug, email: email.trim() } }),
    onSuccess: (r) => {
      if (r.status !== "ok") { setRecusa(r.mensagem); return; }
      setRecusa(null);
      setNome(r.nome);
      setEmailConfirmado(email.trim());
    },
    onError: (e: Error) => setRecusa(e.message),
  });

  const { data: horariosData, isLoading: carregandoHorarios } = useQuery({
    queryKey: ["agendar-horarios", slug, emailConfirmado],
    queryFn: () => horariosFn({ data: { slug, email: emailConfirmado! } }),
    enabled: !!emailConfirmado,
  });

  const dias: Dia[] = horariosData?.status === "ok" ? horariosData.dias : [];
  const diaAtivo = diaSelecionado ?? dias[0]?.data ?? null;
  const horariosDoDia = dias.find((d) => d.data === diaAtivo)?.horarios ?? [];

  const confirmar = useMutation({
    mutationFn: () => confirmarFn({ data: { slug, email: emailConfirmado!, quando: horarioSelecionado! } }),
    onSuccess: (r) => setConfirmado({ quando: r.quando }),
    onError: (e: Error) => setRecusa(e.message),
  });

  if (carregandoLink) return <Shell><p className="text-center text-sm text-muted-foreground">Carregando…</p></Shell>;

  if (!link?.encontrado) {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="mx-auto size-10 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold">Link indisponível</h1>
          <p className="mt-1 text-sm text-muted-foreground">Este endereço não existe ou foi desativado.</p>
        </div>
      </Shell>
    );
  }

  if (confirmado) {
    return (
      <Shell>
        <div className="text-center">
          <CalendarCheck className="mx-auto size-10 text-emerald-500" />
          <h1 className="mt-3 text-lg font-semibold">Sessão confirmada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {link.titulo} — {new Date(confirmado.quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" })}{" "}
            às {horaBr(confirmado.quando)} (horário de Brasília).
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Você vai receber um e-mail com os detalhes.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-semibold tracking-tight">{link.titulo}</h1>
      {link.descricao && <p className="mt-1 text-sm text-muted-foreground">{link.descricao}</p>}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5" /> {link.duracao_min} minutos
      </p>

      {!emailConfirmado ? (
        <div className="mt-6 space-y-3">
          <Label htmlFor="email">Seu e-mail cadastrado</Label>
          <Input
            id="email" type="email" placeholder="voce@exemplo.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && email.trim() && verificar.mutate()}
          />
          {recusa && (
            <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {recusa}
            </p>
          )}
          <Button className="w-full" disabled={!email.trim() || verificar.isPending} onClick={() => verificar.mutate()}>
            <Mail className="size-4" /> {verificar.isPending ? "Conferindo…" : "Continuar"}
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-sm">Olá, {nome || "tudo bem"}! Escolha um horário:</p>

          {carregandoHorarios && <p className="text-sm text-muted-foreground">Buscando horários livres…</p>}

          {!carregandoHorarios && dias.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Não há horários disponíveis no momento. Fale com quem te enviou este link.
            </p>
          )}

          {dias.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {dias.map((d) => (
                  <button
                    key={d.data}
                    onClick={() => { setDiaSelecionado(d.data); setHorarioSelecionado(null); }}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                      d.data === diaAtivo
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-muted/40 text-foreground ring-black/5 hover:bg-muted"
                    }`}
                  >
                    {diaBrExtenso(d.data)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {horariosDoDia.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorarioSelecionado(h)}
                    className={`rounded-md px-2 py-1.5 text-sm ring-1 transition ${
                      h === horarioSelecionado
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-background ring-black/10 hover:bg-muted/40"
                    }`}
                  >
                    {horaBr(h)}
                  </button>
                ))}
              </div>

              {recusa && (
                <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" /> {recusa}
                </p>
              )}

              <Button
                className="w-full" disabled={!horarioSelecionado || confirmar.isPending}
                onClick={() => confirmar.mutate()}
              >
                {confirmar.isPending ? "Confirmando…" : "Confirmar agendamento"}
              </Button>
            </>
          )}
        </div>
      )}
    </Shell>
  );
}
