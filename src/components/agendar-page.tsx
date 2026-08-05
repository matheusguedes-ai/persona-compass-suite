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
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dadosDoLink, verificarEmailAgendamento, horariosLivresAgendamento, confirmarAgendamento } from "@/lib/agendamento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CalendarCheck, ChevronLeft, ChevronRight, Clock, Globe, Mail } from "lucide-react";

function Shell({ children, largo = false }: { children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={`mx-auto px-4 py-16 ${largo ? "max-w-2xl" : "max-w-lg"}`}>
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

// ============================================================
// Datas em "YYYY-MM-DD", sempre pelo mesmo critério de diaBrExtenso: ancora
// ao meio-dia UTC para construir (meio-dia em Brasília nunca vira outro dia
// em UTC-3), e só lê de volta com os getters UTC* — nunca os locais, que
// dependeriam do fuso de quem está com o navegador aberto.
// ============================================================

function paraYmd(ano: number, mesIndice: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mesIndice, dia, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** [ano, mês (0-based), dia] — mesma indexação de mês que Date usa. */
function partesYmd(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split("-").map(Number);
  return [y, m - 1, d];
}

function somarDias(ymd: string, n: number): string {
  const [y, m, d] = partesYmd(ymd);
  const dt = new Date(Date.UTC(y, m, d, 12) + n * 86_400_000);
  return paraYmd(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

/** 0 = domingo … 6 = sábado, sempre relativo ao calendário de Brasília. */
function diaDaSemana(ymd: string): number {
  const [y, m, d] = partesYmd(ymd);
  return new Date(Date.UTC(y, m, d, 12)).getUTCDay();
}

function hojeYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function nomeMesAno(ano: number, mesIndice: number): string {
  const texto = new Date(Date.UTC(ano, mesIndice, 15, 12)).toLocaleDateString("pt-BR", {
    month: "long", year: "numeric", timeZone: "America/Sao_Paulo",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Células do mês: null para o preenchimento antes do dia 1, YMD depois. */
function celulasDoMes(ano: number, mesIndice: number): (string | null)[] {
  const primeiraSemana = diaDaSemana(paraYmd(ano, mesIndice, 1));
  const diasNoMes = new Date(Date.UTC(ano, mesIndice + 1, 0, 12)).getUTCDate();
  const vazios: null[] = Array.from({ length: primeiraSemana }, () => null);
  const dias = Array.from({ length: diasNoMes }, (_, i) => paraYmd(ano, mesIndice, i + 1));
  return [...vazios, ...dias];
}

const SEMANA_ABREV = ["D", "S", "T", "Q", "Q", "S", "S"];
const SEMANA_ABREV_LONGA = ["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];

type Dia = { data: string; horarios: string[] };

// ============================================================
// O seletor: calendário mensal + faixa de 7 dias.
//
// `key={diaSelecionado}` no ponto de uso (mais abaixo) é o que sincroniza os
// dois com a seleção: ao trocar de dia, o React remonta este componente do
// zero, e o estado interno (mês exibido, início da semana) nasce de novo a
// partir do novo dia selecionado. Navegar os meses/semanas sem selecionar
// nada não dispara isso — só a seleção de fato re-sincroniza, como pedido.
// ============================================================

function SeletorDeData({
  dias, diaSelecionado, onSelecionar,
}: {
  dias: Dia[];
  diaSelecionado: string;
  onSelecionar: (ymd: string) => void;
}) {
  const diasComHorario = new Set(dias.map((d) => d.data));
  const hoje = hojeYmd();
  const primeiroDia = dias[0].data;
  const ultimoDia = dias[dias.length - 1].data;

  const [anoIni, mesIni] = partesYmd(diaSelecionado);
  const [mesExibido, setMesExibido] = useState({ ano: anoIni, mes: mesIni });
  const [semanaInicio, setSemanaInicio] = useState(() => somarDias(diaSelecionado, -diaDaSemana(diaSelecionado)));

  const chave = (a: number, m: number) => a * 12 + m;
  const [anoHoje, mesHoje] = partesYmd(hoje);
  const [anoUlt, mesUlt] = partesYmd(ultimoDia);
  const minimoMes = chave(anoHoje, mesHoje);
  const maximoMes = chave(anoUlt, mesUlt);
  const mesAtualChave = chave(mesExibido.ano, mesExibido.mes);

  const primeiraSemanaInicio = somarDias(primeiroDia, -diaDaSemana(primeiroDia));
  const ultimaSemanaInicio = somarDias(ultimoDia, -diaDaSemana(ultimoDia));

  function irParaMes(delta: number) {
    const total = mesAtualChave + delta;
    setMesExibido({ ano: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 });
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium capitalize">{nomeMesAno(mesExibido.ano, mesExibido.mes)}</p>
          <div className="flex gap-1">
            <button
              type="button" aria-label="Mês anterior" disabled={mesAtualChave <= minimoMes}
              onClick={() => irParaMes(-1)}
              className="rounded-md p-1 ring-1 ring-black/10 transition hover:bg-muted/40 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button" aria-label="Próximo mês" disabled={mesAtualChave >= maximoMes}
              onClick={() => irParaMes(1)}
              className="rounded-md p-1 ring-1 ring-black/10 transition hover:bg-muted/40 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {SEMANA_ABREV.map((s, i) => (
            <div key={i} className="py-1 text-center text-[11px] font-medium text-muted-foreground">{s}</div>
          ))}
          {celulasDoMes(mesExibido.ano, mesExibido.mes).map((ymd, i) => {
            if (!ymd) return <div key={`v${i}`} />;
            const disponivel = diasComHorario.has(ymd);
            const selecionado = ymd === diaSelecionado;
            const ehHoje = ymd === hoje;
            const [, , dia] = partesYmd(ymd);
            return (
              <button
                key={ymd}
                type="button"
                disabled={!disponivel}
                aria-pressed={selecionado}
                aria-label={`${diaBrExtenso(ymd)}${disponivel ? "" : ", sem disponibilidade"}`}
                onClick={() => onSelecionar(ymd)}
                className={`aspect-square rounded-full text-sm transition ${
                  selecionado
                    ? "bg-primary font-medium text-primary-foreground"
                    : disponivel
                      ? `text-foreground hover:bg-muted/60 ${ehHoje ? "ring-1 ring-inset ring-primary/60" : ""}`
                      : "cursor-default text-muted-foreground/30"
                }`}
              >
                {dia}
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden items-center gap-1 sm:flex">
        <button
          type="button" aria-label="Semana anterior" disabled={semanaInicio <= primeiraSemanaInicio}
          onClick={() => setSemanaInicio((s) => somarDias(s, -7))}
          className="shrink-0 rounded-md p-1 ring-1 ring-black/10 transition hover:bg-muted/40 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => somarDias(semanaInicio, i)).map((ymd) => {
            const disponivel = diasComHorario.has(ymd);
            const selecionado = ymd === diaSelecionado;
            const [, , dia] = partesYmd(ymd);
            return (
              <button
                key={ymd}
                type="button"
                aria-pressed={selecionado}
                aria-label={`${diaBrExtenso(ymd)}${disponivel ? "" : ", sem disponibilidade"}`}
                onClick={() => onSelecionar(ymd)}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs transition ${
                  selecionado
                    ? "bg-primary text-primary-foreground"
                    : disponivel
                      ? "text-foreground hover:bg-muted/60"
                      : "text-muted-foreground/40 hover:bg-muted/30"
                }`}
              >
                <span className="font-medium">{SEMANA_ABREV_LONGA[diaDaSemana(ymd)]}</span>
                <span>{dia}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button" aria-label="Próxima semana" disabled={semanaInicio >= ultimaSemanaInicio}
          onClick={() => setSemanaInicio((s) => somarDias(s, 7))}
          className="shrink-0 rounded-md p-1 ring-1 ring-black/10 transition hover:bg-muted/40 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
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
  const proximaComHorario = diaAtivo ? dias.find((d) => d.data > diaAtivo && d.horarios.length > 0) : undefined;

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

          {dias.length > 0 && diaAtivo && (
            <>
              <SeletorDeData key={diaAtivo} dias={dias} diaSelecionado={diaAtivo} onSelecionar={selecionarDia} />

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe className="size-3.5" /> (GMT-03:00) Horário de Brasília
              </div>

              {horariosDoDia.length === 0 ? (
                <div className="rounded-lg bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  <p>Sem disponibilidade nesses dias.</p>
                  {proximaComHorario && (
                    <button
                      type="button"
                      onClick={() => selecionarDia(proximaComHorario.data)}
                      className="mt-1 font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Pular para a próxima data disponível
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {horariosDoDia.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={h === horarioSelecionado}
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
              )}

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
