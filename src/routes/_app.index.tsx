import { createFileRoute, Link } from "@tanstack/react-router";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listResponses } from "@/lib/tests.functions";
import { listPeople } from "@/lib/data.functions";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Métrica Humana" },
      { name: "description", content: "Visão geral dos testes enviados, respondidos e pendentes na plataforma de assessments." },
      { property: "og:title", content: "Dashboard — Métrica Humana" },
      { property: "og:description", content: "Visão geral dos testes enviados, respondidos e pendentes na plataforma de assessments." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const listRespFn = useServerFn(listResponses);
  const listPeopleFn = useServerFn(listPeople);
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["dash-responses"],
    queryFn: () => listRespFn({ data: {} }),
  });
  const { data: people = [] } = useQuery({
    queryKey: ["dash-people"],
    queryFn: () => listPeopleFn(),
  });

  type Resp = {
    id: string;
    status: string;
    created_at: string;
    submitted_at: string | null;
    people: { id: string; full_name: string; email: string } | null;
    test_versions: { id: string; title: string } | null;
  };
  const rs = responses as Resp[];
  const total = rs.length;
  const submitted = rs.filter((r) => r.status === "submitted").length;
  const pending = total - submitted;
  const conversion = total > 0 ? Math.round((submitted / total) * 100) : 0;

  const recent = useMemo(
    () => [...rs]
      .sort((a, b) => new Date(b.submitted_at ?? b.created_at).getTime() - new Date(a.submitted_at ?? a.created_at).getTime())
      .slice(0, 5),
    [rs],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe seus disparos e respostas em tempo real.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Testes enviados" value={isLoading ? "…" : String(total)} />
        <KpiCard label="Respondidos" value={isLoading ? "…" : String(submitted)} hint={total > 0 ? `${conversion}% de conversão` : "Nenhum envio ainda"} />
        <KpiCard label="Pendentes" value={isLoading ? "…" : String(pending)} hintTone={pending > 0 ? "warn" : undefined} />
        <KpiCard label="Pessoas cadastradas" value={String(people.length)} />
      </section>

      <section className="rounded-xl bg-card p-6 ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium tracking-tight">Disparo rápido</h2>
            <p className="text-xs text-muted-foreground">Crie um novo envio para um avaliado.</p>
          </div>
          <Link to="/envios/novo" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            Novo envio
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium tracking-tight">Atividade recente</h2>
          <Link to="/envios" className="text-xs font-medium text-accent hover:underline">Ver todos</Link>
        </div>
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
          {recent.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {isLoading ? "Carregando…" : "Nenhum envio ainda. Crie o primeiro em Envios."}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/5 bg-muted/50">
                <tr>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Avaliado</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Teste</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {recent.map((s) => {
                  const when = s.submitted_at ?? s.created_at;
                  const status: "pending" | "submitted" = s.status === "submitted" ? "submitted" : "pending";
                  return (
                    <tr key={s.id}>
                      <td className="px-6 py-4 font-medium">{s.people?.full_name ?? "—"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{s.test_versions?.title ?? "—"}</td>
                      <td className="px-6 py-4"><StatusBadge status={status} /></td>
                      <td className="px-6 py-4 text-muted-foreground">{new Date(when).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}