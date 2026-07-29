import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/data.functions";
import { getMyMembership } from "@/lib/team.functions";

/**
 * O mentor afiliado não tem dashboard próprio: o do dono mostraria números da
 * conta inteira, que não são dele. Vai direto para Grupos, que é o trabalho
 * dele na plataforma.
 */
function RedirecionaMentor({ children }: { children: React.ReactNode }) {
  const membershipFn = useServerFn(getMyMembership);
  const { data } = useQuery({
    queryKey: ["my-membership"], queryFn: () => membershipFn(), staleTime: 300_000,
  });
  // O painel do mentor é o do ALUNO, com Grupos a mais — ele é um avaliado
  // promovido. O dashboard do dono mostraria números da conta que não são dele.
  if (data?.kind === "mentor") return <Navigate to="/aluno" search={{ ver: undefined }} />;
  return <>{children}</>;
}

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Métrica Humana" },
      { name: "description", content: "Visão geral dos testes enviados, respondidos e pendentes na plataforma de assessments." },
      { property: "og:title", content: "Dashboard — Métrica Humana" },
      { property: "og:description", content: "Visão geral dos testes enviados, respondidos e pendentes na plataforma de assessments." },
    ],
  }),
  component: () => (
    <RedirecionaMentor>
      <Dashboard />
    </RedirecionaMentor>
  ),
});

function Dashboard() {
  const statsFn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => statsFn(),
  });

  const total = data?.total ?? 0;
  const submitted = data?.submitted ?? 0;
  const pending = data?.pending ?? 0;
  const conversion = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const byMonth = data?.byMonth ?? [];
  const byInstrument = data?.byInstrument ?? [];
  const recent = data?.recent ?? [];

  const mesPico = Math.max(1, ...byMonth.map((m) => m.respondidos));
  const instrPico = Math.max(1, ...byInstrument.map((i) => i.respondidos + i.pendentes));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe seus disparos e respostas em tempo real.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Testes enviados" value={isLoading ? "…" : String(total)} hint="Inclui os testes de cada bateria" />
        <KpiCard
          label="Respondidos"
          value={isLoading ? "…" : String(submitted)}
          hint={total > 0 ? `${conversion}% de conversão` : "Nenhum envio ainda"}
        />
        <KpiCard label="Pendentes" value={isLoading ? "…" : String(pending)} hintTone={pending > 0 ? "warn" : undefined} />
        <KpiCard label="Pessoas cadastradas" value={isLoading ? "…" : String(data?.people ?? 0)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* Ritmo: mostra se o movimento está crescendo ou parou. */}
        <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <h2 className="text-sm font-medium tracking-tight">Testes respondidos por mês</h2>
          <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
          {submitted === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {isLoading ? "Carregando…" : "Aparece aqui quando o primeiro teste for concluído."}
            </p>
          ) : (
            <div className="mt-5 flex h-36 items-end gap-2">
              {byMonth.map((m) => (
                <div key={m.chave} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {m.respondidos > 0 ? m.respondidos : ""}
                  </span>
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{ height: `${Math.max(m.respondidos > 0 ? 4 : 2, (m.respondidos / mesPico) * 100)}%` }}
                    title={`${m.respondidos} em ${m.mes}`}
                  />
                  <span className="text-xs capitalize text-muted-foreground">{m.mes}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quais inventários estão de fato sendo usados. */}
        <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <h2 className="text-sm font-medium tracking-tight">Inventários aplicados</h2>
          <p className="text-xs text-muted-foreground">Respondidos e pendentes por teste</p>
          {byInstrument.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {isLoading ? "Carregando…" : "Nenhum teste enviado ainda."}
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {byInstrument.map((inst) => (
                <div key={inst.name}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{inst.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {inst.respondidos} respondido{inst.respondidos === 1 ? "" : "s"}
                      {inst.pendentes > 0 && ` · ${inst.pendentes} pendente${inst.pendentes === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="bg-primary" style={{ width: `${(inst.respondidos / instrPico) * 100}%` }} />
                    <div className="bg-amber-400/70" style={{ width: `${(inst.pendentes / instrPico) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-card p-6 ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium tracking-tight">Disparo rápido</h2>
            <p className="text-xs text-muted-foreground">Crie um novo envio para um avaliado.</p>
          </div>
          <Link to="/envios/novo" search={{ personId: undefined, groupId: undefined }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
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
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td className="px-6 py-4 font-medium">{s.nome}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {s.teste}
                      {s.emBateria && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                          bateria
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={s.concluido ? "concluido" : "pendente"} /></td>
                    <td className="px-6 py-4 text-muted-foreground">{new Date(s.quando).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
