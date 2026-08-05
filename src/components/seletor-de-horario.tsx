/**
 * Calendário mensal + faixa de 7 dias + horários — o seletor de data/hora
 * usado tanto em /agendar/$slug (marcar pela primeira vez) quanto em
 * /sessao/$id (remarcar, Fatia 4b Parte 2). Extraído de agendar-page.tsx no
 * #254 para não duplicar a lógica de fuso horário e a sincronização entre o
 * calendário e a faixa — ver o comentário de `SeletorDeData` mais abaixo.
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";

export function diaBrExtenso(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const texto = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function horaBr(iso: string): string {
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

export type Dia = { data: string; horarios: string[] };

// ============================================================
// O calendário: mês + faixa de 7 dias.
//
// `key={diaSelecionado}` no ponto de uso é o que sincroniza os dois com a
// seleção: ao trocar de dia, o React remonta este componente do zero, e o
// estado interno (mês exibido, início da semana) nasce de novo a partir do
// novo dia selecionado. Navegar os meses/semanas sem selecionar nada não
// dispara isso — só a seleção de fato re-sincroniza, como pedido.
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

/**
 * O bloco completo: calendário + faixa + fuso + grade de horários (ou o
 * aviso "sem disponibilidade" com o atalho para a próxima data). Dono do
 * estado (dia selecionado, horário selecionado) é sempre quem chama —
 * este componente só mostra e avisa, nunca decide sozinho.
 */
export function SeletorDeHorario({
  dias, diaSelecionado, horarioSelecionado, onSelecionarDia, onSelecionarHorario,
}: {
  dias: Dia[];
  diaSelecionado: string;
  horarioSelecionado: string | null;
  onSelecionarDia: (ymd: string) => void;
  onSelecionarHorario: (iso: string) => void;
}) {
  const horariosDoDia = dias.find((d) => d.data === diaSelecionado)?.horarios ?? [];
  const proximaComHorario = dias.find((d) => d.data > diaSelecionado && d.horarios.length > 0);

  return (
    <>
      <SeletorDeData key={diaSelecionado} dias={dias} diaSelecionado={diaSelecionado} onSelecionar={onSelecionarDia} />

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Globe className="size-3.5" /> (GMT-03:00) Horário de Brasília
      </div>

      {horariosDoDia.length === 0 ? (
        <div className="rounded-lg bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          <p>Sem disponibilidade nesses dias.</p>
          {proximaComHorario && (
            <button
              type="button"
              onClick={() => onSelecionarDia(proximaComHorario.data)}
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
              onClick={() => onSelecionarHorario(h)}
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
    </>
  );
}
