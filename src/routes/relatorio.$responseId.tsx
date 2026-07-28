import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useApplyBrand } from "@/lib/brand";
import { usePodeBaixar } from "@/lib/pode-baixar";
import {
  ActionPlanSection,
  PLANO_ACAO,
  PLANO_ACAO_GENERICO,
  PRINT_CSS,
  ReportBody,
  ReportBrandHeader,
  ReportFooter,
  Section,
  type Report,
} from "@/components/report/sections";

export const Route = createFileRoute("/relatorio/$responseId")({
  head: () => ({
    meta: [
      { title: "Relatório comportamental" },
      { name: "description", content: "Relatório comportamental detalhado do avaliado, com perfil natural e adaptado." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Relatório comportamental" },
      { property: "og:description", content: "Relatório comportamental detalhado do avaliado, com perfil natural e adaptado." },
    ],
  }),
  component: RelatorioPage,
});

function RelatorioPage() {
  const { responseId } = Route.useParams();
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/report/${responseId}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) { setError(json.error ?? "Relatório indisponível."); return; }
        setData(json as Report);
      })
      .catch(() => setError("Falha de conexão. Tente novamente."));
  }, [responseId]);

  // A marca é a do mentor dono do link, não a de quem abre (ninguém está logado).
  useApplyBrand(data?.brand);
  // null = ninguém logado; aí vale a preferência do mentor dono.
  const podeBaixar = usePodeBaixar(responseId);

  if (error) return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">{error}</div>;
  if (!data) return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">Carregando relatório…</div>;

  const isDisc = data.is_disc !== false;
  const rankedFactors = [...data.factors].sort((a, b) => b.natural_norm - a.natural_norm);

  return (
    <div className="report-root mx-auto max-w-3xl space-y-6 p-6 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>

      {(podeBaixar ?? data.settings?.allow_pdf !== false) && (
        <div className="flex justify-end print:hidden">
          <Button onClick={() => window.print()}><Printer className="size-4" /> Baixar PDF</Button>
        </div>
      )}

      <Section>
        <ReportBrandHeader brand={data.brand} />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Relatório comportamental</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{data.person_name ?? "Avaliado"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.test_title}</p>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Concluído em</dt>
            <dd className="font-medium">{new Date(data.submitted_at).toLocaleDateString("pt-BR")}</dd>
          </div>
          {data.duration && (
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Duração</dt>
              <dd className="font-medium">{data.duration}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Perfil</dt>
            <dd className="font-medium">{data.profile ?? rankedFactors[0]?.label ?? "—"}</dd>
          </div>
        </dl>
      </Section>

      <ReportBody data={data} />

      {!(data.settings?.hidden_blocks ?? []).includes("plano_acao") && (
        <ActionPlanSection responseId={responseId} questions={isDisc ? PLANO_ACAO : PLANO_ACAO_GENERICO} />
      )}

      <ReportFooter brand={data.brand} />
    </div>
  );
}
