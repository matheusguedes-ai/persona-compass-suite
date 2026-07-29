/**
 * Devolutivas do avaliado — o arquivo dele.
 *
 * Do lado do mentor a tela é operacional: quem está esperando, o que agendar.
 * Aqui é histórico: quando foi a conversa, com quem, o que ficou combinado e o
 * relatório daquela vez. É o que a pessoa procura meses depois, quando quer
 * lembrar do que decidiu.
 *
 * O campo de anotações do mentor não aparece aqui de propósito — ver
 * `getMinhasDevolutivas`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMinhasDevolutivas } from "@/lib/student.functions";
import { Agenda } from "@/components/agenda";
import { Button } from "@/components/ui/button";
import { CalendarClock, CheckCircle2, FileText, MessagesSquare } from "lucide-react";

function dataBr(iso: string | null) {
  if (!iso) return null;
  const soData = /^\d{4}-\d{2}-\d{2}$/.exec(iso);
  const d = soData
    ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
    : new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
function dataHoraBr(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Devolutivas() {
  const fn = useServerFn(getMinhasDevolutivas);
  const { data, isLoading } = useQuery({ queryKey: ["minhas-devolutivas"], queryFn: () => fn() });

  const lista = data?.devolutivas ?? [];
  const agendadas = lista.filter((d) => d.status === "agendada");
  const realizadas = lista.filter((d) => d.status === "realizada");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Devolutivas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          As conversas em que seu resultado foi apresentado, e o que ficou combinado em cada uma.
        </p>
      </header>

      {/* A mesma agenda do mentor, sem mudar nada: a RLS já entrega ao aluno
          só as devolutivas dele. Só aparece quando há o que mostrar — mês
          vazio para quem nunca teve devolutiva é ruído. */}
      {!isLoading && lista.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium">No calendário</h2>
          <Agenda area="aluno" somenteMinhas />
        </section>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && lista.length === 0 && (
        <div className="rounded-xl bg-muted/40 p-6">
          <p className="text-sm text-muted-foreground">
            Você ainda não tem devolutiva marcada. Assim que seu mentor agendar, ela aparece aqui com a
            data — e depois da conversa você encontra aqui o que foi combinado.
          </p>
        </div>
      )}

      {agendadas.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Marcadas</h2>
          <ul className="mt-3 space-y-3">
            {agendadas.map((d) => (
              <li key={d.id} className="rounded-xl border border-black/5 bg-card p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CalendarClock className="size-4" />
                  {dataHoraBr(d.scheduled_at) ?? "data ainda a combinar"}
                </p>
                {d.mentor && <p className="mt-1 text-sm text-muted-foreground">com {d.mentor}</p>}
                {d.relatorio && (
                  <Button variant="outline" size="sm" asChild className="mt-3">
                    <a href={d.relatorio} target="_blank" rel="noreferrer">
                      <FileText className="size-3.5" /> Ver o relatório
                    </a>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {realizadas.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Já realizadas</h2>
          <ul className="mt-3 space-y-3">
            {realizadas.map((d) => (
              <li key={d.id} className="rounded-xl border border-black/5 bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    {dataBr(d.completed_at) ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.mentor ? `com ${d.mentor}` : ""}
                    {d.duration_min ? ` · ${d.duration_min} min` : ""}
                  </p>
                </div>

                {d.agreements && (
                  <div className="mt-3 rounded-lg bg-muted/40 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <MessagesSquare className="size-3" /> O que combinamos
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed">{d.agreements}</p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {d.relatorio && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={d.relatorio} target="_blank" rel="noreferrer">
                        <FileText className="size-3.5" /> Ver o relatório
                      </a>
                    </Button>
                  )}
                  {d.next_at && (
                    <span className="text-xs text-muted-foreground">
                      Próximo acompanhamento: {dataBr(d.next_at)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const Route = createFileRoute("/aluno/devolutivas")({
  head: () => ({
    meta: [
      { title: "Devolutivas — Métrica Humana" },
      { name: "description", content: "Suas conversas de devolutiva e o que ficou combinado em cada uma." },
    ],
  }),
  component: Devolutivas,
});
