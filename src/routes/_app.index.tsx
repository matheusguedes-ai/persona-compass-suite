import { createFileRoute, Link } from "@tanstack/react-router";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import {
  ACTIVITY_LAST_20,
  INSTRUMENTS,
  SENDS,
  personById,
  instrumentById,
  CATEGORY_LABEL,
} from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

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

const ACCENT_BG: Record<string, string> = {
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  teal: "bg-teal-100 text-teal-700",
  violet: "bg-violet-100 text-violet-700",
  zinc: "bg-zinc-200 text-zinc-700",
};

function Dashboard() {
  const max = Math.max(...ACTIVITY_LAST_20);
  const recent = SENDS.slice(0, 5);
  const featured = INSTRUMENTS.slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe seus disparos e respostas em tempo real.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Testes enviados" value="1.284" hint="+12% vs mês passado" hintTone="positive" />
        <KpiCard label="Respondidos" value="942" hint="73% de conversão" />
        <KpiCard label="Pendentes" value="342" hint="18 vencendo hoje" hintTone="warn" />
        <KpiCard label="Tempo médio" value="14m 22s" hint="-2m vs benchmark" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl bg-card p-6 ring-1 ring-black/5 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium tracking-tight">Atividade de avaliações</h2>
              <p className="text-xs text-muted-foreground">Últimos 20 dias</p>
            </div>
          </div>
          <div className="flex h-48 items-end gap-2 px-1">
            {ACTIVITY_LAST_20.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-accent/40"
                style={{ height: `${(v / max) * 100}%` }}
              />
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-zinc-900 p-6 text-zinc-50 shadow-xl">
          <h3 className="text-sm font-medium">Disparo rápido</h3>
          <p className="mt-1 max-w-[38ch] text-xs text-zinc-400">
            Envie um teste rapidamente para um avaliado existente.
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Avaliado</label>
              <div className="mt-1 flex items-center justify-between rounded border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-sm">
                <span className="text-zinc-400">Selecionar...</span>
                <ChevronDown className="size-3 text-zinc-500" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Instrumento</label>
              <div className="mt-1 flex items-center justify-between rounded border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-sm">
                <span>Análise DISC</span>
                <ChevronDown className="size-3 text-zinc-500" />
              </div>
            </div>
            <Button asChild variant="secondary" className="w-full bg-zinc-50 text-zinc-900 hover:bg-white">
              <Link to="/envios/novo">Gerar link de convite</Link>
            </Button>
          </div>
        </section>
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium tracking-tight">Catálogo em destaque</h2>
          <Link to="/testes" className="text-xs font-medium text-accent hover:underline">Ver todos</Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {featured.map((t) => (
            <div key={t.id} className="rounded-xl bg-card p-6 ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${ACCENT_BG[t.accent]}`}>
                  {CATEGORY_LABEL[t.category]}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{t.durationMin}min</span>
              </div>
              <h3 className="mt-6 text-lg font-medium tracking-tight">{t.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium tracking-tight">Últimos envios</h2>
          <Link to="/envios" className="text-xs font-medium text-accent hover:underline">Ver todos</Link>
        </div>
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-muted/50">
              <tr>
                <th className="px-6 py-3 font-medium text-muted-foreground">Avaliado</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Instrumento</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Data</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {recent.map((s) => {
                const p = personById(s.personId);
                const i = instrumentById(s.instrumentId);
                return (
                  <tr key={s.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-6 rounded-full bg-zinc-200 ring-1 ring-black/5" />
                        <span className="font-medium">{p?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{i?.name}</td>
                    <td className="px-6 py-4"><StatusBadge status={s.status} /></td>
                    <td className="px-6 py-4 text-muted-foreground">{new Date(s.sentAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-6 py-4 text-right">
                      <Link to="/envios" className="text-xs font-medium text-accent hover:underline">Detalhes</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}