/**
 * O Kanban das devolutivas.
 *
 * Um componente só, usado pelo master em `/gestao` e pelo mentor em
 * `/aluno/gestao`. Não há `if` de papel aqui: a RLS já recorta os dados, então
 * o mentor recebe só a gente dos grupos dele pelo mesmo caminho.
 *
 * NÃO SE ARRASTA CARTÃO. Mover de "sem devolutiva" para "realizada" registraria
 * uma conversa que não aconteceu, e mover para "agendada" precisaria de uma
 * data que o arrastar não tem como perguntar. O cartão leva para a ação de
 * verdade — que é onde essas informações são pedidas.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { quadroDeGestao, type CartaoGestao } from "@/lib/gestao.functions";
import { CalendarClock, CheckCircle2, Clock } from "lucide-react";

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  // Data sem hora chega como "2026-07-30" e `new Date` leria meia-noite UTC,
  // mostrando o dia anterior no Brasil. Monta local a partir das partes.
  const so = iso.slice(0, 10).split("-").map(Number);
  const d = so.length === 3 ? new Date(so[0], so[1] - 1, so[2]) : new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function legenda(c: CartaoGestao, coluna: "espera" | "agendada" | "feita"): string {
  if (c.dias === null) return dataBr(c.quando);
  if (coluna === "espera") {
    if (c.dias === 0) return "concluiu hoje";
    return `espera há ${c.dias} ${c.dias === 1 ? "dia" : "dias"}`;
  }
  if (coluna === "agendada") {
    if (c.dias === 0) return "é hoje";
    if (c.dias === 1) return "é amanhã";
    if (c.dias > 0) return `em ${c.dias} dias · ${dataBr(c.quando)}`;
    return `atrasada há ${Math.abs(c.dias)} ${Math.abs(c.dias) === 1 ? "dia" : "dias"}`;
  }
  if (c.dias === 0) return "hoje";
  return `há ${c.dias} ${c.dias === 1 ? "dia" : "dias"}`;
}

function Coluna({
  titulo, subtitulo, icone: Icone, cartoes, coluna, vazio, tom,
}: {
  titulo: string;
  subtitulo: string;
  icone: typeof Clock;
  cartoes: CartaoGestao[];
  coluna: "espera" | "agendada" | "feita";
  vazio: string;
  tom: string;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-muted/30 p-3">
      <div className="flex items-center gap-2 px-1 pb-3">
        <Icone className={`size-4 ${tom}`} />
        <h2 className="text-sm font-medium">{titulo}</h2>
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
          {cartoes.length}
        </span>
      </div>
      <p className="px-1 pb-3 text-xs text-muted-foreground">{subtitulo}</p>

      {cartoes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/10 px-3 py-8 text-center text-xs text-muted-foreground">
          {vazio}
        </p>
      ) : (
        <ul className="space-y-2">
          {cartoes.map((c) => (
            <li key={c.id}>
              <Link
                to="/pessoas/$id"
                params={{ id: c.person_id }}
                className="block rounded-lg bg-card p-3 ring-1 ring-black/5 transition hover:ring-black/15"
              >
                <p className="truncate text-sm font-medium">{c.person_name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.titulo}</p>
                <p className={`mt-1.5 text-xs ${c.atrasada ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {legenda(c, coluna)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function QuadroGestao() {
  const fn = useServerFn(quadroDeGestao);
  const { data, isLoading } = useQuery({ queryKey: ["quadro-gestao"], queryFn: () => fn() });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const sem = data?.semDevolutiva ?? [];
  const ag = data?.agendadas ?? [];
  const fe = data?.realizadas ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Em que pé está cada pessoa. Clique num cartão para abrir a ficha dela e agir.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <Coluna
          titulo="Sem devolutiva"
          subtitulo="Respondeu e ninguém conversou ainda"
          icone={Clock}
          tom="text-amber-500"
          cartoes={sem}
          coluna="espera"
          vazio="Ninguém esperando. É o estado bom."
        />
        <Coluna
          titulo="Agendada"
          subtitulo="Data marcada, conversa por acontecer"
          icone={CalendarClock}
          tom="text-sky-500"
          cartoes={ag}
          coluna="agendada"
          vazio="Nada marcado."
        />
        <Coluna
          titulo="Realizada"
          subtitulo="Conversa feita e registrada"
          icone={CheckCircle2}
          tom="text-emerald-500"
          cartoes={fe}
          coluna="feita"
          vazio="Nenhuma ainda."
        />
      </div>
    </div>
  );
}
