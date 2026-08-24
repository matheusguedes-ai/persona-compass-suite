/**
 * #221 F1 — a lista de quem concluiu, para o Classroom e para a Academy.
 *
 * Um componente de tela só, porque os dois lados já chegam aqui com a MESMA
 * forma — a régua central (`src/lib/regua-de-conclusao.ts`). Só a busca dos
 * dados é diferente: cada aba pergunta ao seu próprio motor
 * (`listaDeConcluidosTreinamento` no Classroom, `listaDeConcluidosTrilha` na
 * Academy), sem fundir as duas estruturas — ver a nota no motor.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { listaDeConcluidosTreinamento } from "@/lib/classroom.functions";
import { listaDeConcluidosTrilha } from "@/lib/learning.functions";

type Pessoa = {
  person_id: string;
  nome: string;
  email: string | null;
  feitos: number;
  total: number;
  percentual: number | null;
  percentual_exigido: number;
  concluido: boolean;
};

function Lista({
  isLoading, totalItens, pessoas,
}: {
  isLoading: boolean;
  totalItens: number | undefined;
  pessoas: Pessoa[] | undefined;
}) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!totalItens) {
    return (
      <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground ring-1 ring-black/5">
        Ainda não há aula nenhuma para medir conclusão.
      </p>
    );
  }
  if (!pessoas || pessoas.length === 0) {
    return (
      <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground ring-1 ring-black/5">
        Ninguém na turma ainda.
      </p>
    );
  }

  const concluidos = pessoas.filter((p) => p.concluido);
  const restante = pessoas.filter((p) => !p.concluido);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{concluidos.length}</strong> de{" "}
        <strong className="text-foreground">{pessoas.length}</strong> concluíram, com{" "}
        {pessoas[0]?.percentual_exigido ?? 100}% exigido.
      </p>
      <div className="space-y-2">
        {[...concluidos, ...restante].map((p) => (
          <div key={p.person_id} className="flex items-center gap-3 rounded-lg bg-card p-3 ring-1 ring-black/5">
            {p.concluido ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.nome}</p>
              {p.email && <p className="truncate text-[11px] text-muted-foreground">{p.email}</p>}
            </div>
            <div className="hidden w-28 shrink-0 sm:block">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", p.concluido ? "bg-emerald-500" : "bg-primary")}
                  style={{ width: `${p.percentual ?? 0}%` }}
                />
              </div>
            </div>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {p.feitos} de {p.total} · {p.percentual ?? 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListaDeConcluidosTreinamento({ treinamentoId }: { treinamentoId: string }) {
  const fn = useServerFn(listaDeConcluidosTreinamento);
  const { data, isLoading } = useQuery({
    queryKey: ["concluidos-treinamento", treinamentoId],
    queryFn: () => fn({ data: { treinamento_id: treinamentoId } }),
  });
  return <Lista isLoading={isLoading} totalItens={data?.total_itens} pessoas={data?.pessoas} />;
}

export function ListaDeConcluidosTrilha({ trackId }: { trackId: string }) {
  const fn = useServerFn(listaDeConcluidosTrilha);
  const { data, isLoading } = useQuery({
    queryKey: ["concluidos-trilha", trackId],
    queryFn: () => fn({ data: { track_id: trackId } }),
  });
  return <Lista isLoading={isLoading} totalItens={data?.total_itens} pessoas={data?.pessoas} />;
}
