import { createFileRoute } from "@tanstack/react-router";
import { KpiCard } from "@/components/kpi-card";
import { BarChart3, PieChart, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/_app/estatisticas")({
  head: () => ({
    meta: [
      { title: "Estatísticas — Métrica Humana" },
      { name: "description", content: "Indicadores quantitativos e qualitativos das respostas dos avaliados." },
      { property: "og:title", content: "Estatísticas — Métrica Humana" },
      { property: "og:description", content: "Indicadores quantitativos e qualitativos das respostas dos avaliados." },
    ],
  }),
  component: EstatisticasPage,
});

function EstatisticasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Estatísticas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Análise agregada das respostas por instrumento, grupo e período.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Testes respondidos" value="—" icon={BarChart3} hint="Aguardando dados" />
        <KpiCard label="Perfil DISC dominante" value="—" icon={PieChart} hint="Aguardando dados" />
        <KpiCard label="Taxa de conclusão" value="—" icon={TrendingUp} hint="Aguardando dados" />
        <KpiCard label="Avaliados ativos" value="—" icon={Users} hint="Aguardando dados" />
      </div>

      <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
        <BarChart3 className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-4 text-base font-medium">Gráficos em construção</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Assim que os testes forem construídos e começarem a ser respondidos, esta área exibirá
          distribuições por instrumento, comparativos entre grupos e evolução no tempo.
        </p>
      </div>
    </div>
  );
}