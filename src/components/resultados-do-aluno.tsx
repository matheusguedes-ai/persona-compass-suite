/**
 * Os gráficos do resultado, no painel do avaliado.
 *
 * A régua de cores é a mesma do relatório do mentor: se o aluno vê verde onde o
 * mentor vê verde, a conversa da mentoria fica mais fácil. Duas telas com
 * escalas diferentes para o mesmo número seria pedir confusão.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeusResultados } from "@/lib/student.functions";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

function corDaNota(v: number) {
  if (v < 20) return "bg-red-500";
  if (v < 40) return "bg-orange-500";
  if (v < 60) return "bg-amber-500";
  if (v < 80) return "bg-emerald-500";
  return "bg-teal-500";
}

export function ResultadosDoAluno({ previewPersonId }: { previewPersonId?: string | null }) {
  const fn = useServerFn(getMeusResultados);
  const { data, isLoading } = useQuery({
    queryKey: ["meus-resultados", previewPersonId ?? null],
    queryFn: () => fn({ data: { preview_person_id: previewPersonId ?? null } }),
  });

  const resultados = data?.resultados ?? [];
  if (isLoading || resultados.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold">Seus resultados</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        O retrato que saiu de cada inventário que você respondeu. O relatório completo traz a leitura
        por escrito.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {resultados.map((r) => (
          <div key={r.response_id} className="rounded-xl border border-black/5 bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{r.titulo}</h3>
              {r.tipo_mbti ? (
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold tracking-widest">{r.tipo_mbti}</span>
              ) : r.perfil ? (
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">{r.perfil}</span>
              ) : null}
            </div>

            <div className="mt-4 space-y-2.5">
              {r.fatores.map((f) => (
                <div key={f.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{f.label}</span>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{f.valor}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", !f.color && corDaNota(f.valor))}
                      style={{ width: `${f.valor}%`, ...(f.color ? { background: f.color } : {}) }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" asChild className="mt-4">
              <a href={`/relatorio/${r.response_id}`} target="_blank" rel="noreferrer">
                <FileText className="size-3.5" /> Ler o relatório
              </a>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
