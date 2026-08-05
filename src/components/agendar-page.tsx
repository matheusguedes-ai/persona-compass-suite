/**
 * /agendar/$slug — auto-agendamento sem login (Fatia 4a).
 *
 * Só quem já está cadastrado agenda: a pessoa informa o e-mail, a página
 * confere contra `people` daquela conta, e só então mostra os horários. Ver
 * docs/plano-mentorias-fatia4.md — a segurança está no slug secreto, não em
 * esconder quem está cadastrado, por isso a recusa por e-mail é clara.
 *
 * #252: o seletor de data virou calendário mensal + faixa de 7 dias, no
 * formato que o mercado já reconhece (Google Agenda, Calendly) — antes era
 * uma lista de pastilhas com um botão por dia da janela inteira (até 42, com
 * a antecedência padrão de 60 dias). Só troca a apresentação: o servidor
 * continua devolvendo a janela inteira de uma vez (`horariosLivresAgendamento`
 * não mudou), quem decide o que mostrar em cada tela é o componente.
 *
 * #254: o calendário/faixa/horários virou `SeletorDeHorario`, compartilhado
 * com /sessao/$id (remarcar) — ver seletor-de-horario.tsx.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dadosDoLink, verificarEmailAgendamento, horariosLivresAgendamento, confirmarAgendamento } from "@/lib/agendamento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeletorDeHorario, horaBr, type Dia } from "@/components/seletor-de-horario";
import { AlertCircle, CalendarCheck, Clock, Link2, Mail, MapPin } from "lucide-react";

function Shell({ children, largo = false }: { children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={`mx-auto px-4 py-16 ${largo ? "max-w-2xl" : "max-w-lg"}`}>
      <div className="rounded-xl bg-card p-8 ring-1 ring-black/5">{children}</div>
    </div>
  );
}

export function AgendarPage({ slug }: { slug: string }) {
  const dadosFn = useServerFn(dadosDoLink);
  const verificarFn = useServerFn(verificarEmailAgendamento);
  const horariosFn = useServerFn(horariosLivresAgendamento);
  const confirmarFn = useServerFn(confirmarAgendamento);

  const { data: link, isLoading: carregandoLink } = useQuery({
    queryKey: ["agendar-dados-link", slug],
    queryFn: () => dadosFn({ data: { slug } }),
  });

  const [fotoErro, setFotoErro] = useState(false);
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

  function selecionarDia(ymd: string) {
    setDiaSelecionado(ymd);
    setHorarioSelecionado(null);
  }

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
    <Shell largo={!!emailConfirmado && dias.length > 0}>
      <div className="flex items-center gap-2.5">
        {!fotoErro && (
          <img
            src={link.professor_foto_url}
            onError={() => setFotoErro(true)}
            alt={link.professor_nome}
            className="size-9 shrink-0 rounded-full object-cover ring-1 ring-black/10"
          />
        )}
        <p className="text-sm font-medium">{link.professor_nome}</p>
      </div>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">{link.titulo}</h1>
      {link.descricao && <p className="mt-1 text-sm text-muted-foreground">{link.descricao}</p>}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5" /> {link.duracao_min} minutos
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {link.modalidade === "presencial" ? <MapPin className="size-3.5" /> : <Link2 className="size-3.5" />}
        {link.modalidade === "presencial" ? (link.local || "Presencial") : (link.link_url || "Online")}
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

          {dias.length > 0 && diaAtivo && (
            <>
              <SeletorDeHorario
                dias={dias}
                diaSelecionado={diaAtivo}
                horarioSelecionado={horarioSelecionado}
                onSelecionarDia={selecionarDia}
                onSelecionarHorario={setHorarioSelecionado}
              />

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
