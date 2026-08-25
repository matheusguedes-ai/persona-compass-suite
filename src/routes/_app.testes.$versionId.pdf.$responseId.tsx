/**
 * #280 — download individual em PDF, pergunta a pergunta, de uma resposta de
 * teste do CONSTRUTOR (sem interpretação). Mesmo mecanismo do resto da
 * plataforma: impressão do navegador com PRINT_CSS (ver relatorio.$responseId.tsx),
 * sem biblioteca de PDF nova. Só o dono chega aqui com dado —
 * getIndividualResponseParaPdf recusa colaborador antes de buscar qualquer
 * coisa; a tela nem precisa checar de novo.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIndividualResponseParaPdf } from "@/lib/exportar-respostas.functions";
import { formatarResposta } from "@/lib/tests.functions";
import { Button } from "@/components/ui/button";
import { PRINT_CSS, ReportBrandHeader, type ReportBrand } from "@/components/report/sections";
import { useBrand, type Brand } from "@/lib/brand";
import { ArrowLeft, Printer } from "lucide-react";

// ReportBrand (usado nos relatórios públicos) exige string | null; useBrand()
// devolve string | null | undefined — mesma marca, dois formatos porque um
// vem de fetch público e o outro do contexto autenticado.
function paraReportBrand(b: Brand | null): ReportBrand | null {
  if (!b) return null;
  return {
    company_name: b.company_name ?? null,
    company_cnpj: b.company_cnpj ?? null,
    company_seal_name: b.company_seal_name ?? null,
    logo_url: b.logo_url ?? null,
    brand_color: b.brand_color ?? null,
    brand_accent_color: b.brand_accent_color ?? null,
    site_url: b.site_url ?? null,
    support_email: b.support_email ?? null,
  };
}

export const Route = createFileRoute("/_app/testes/$versionId/pdf/$responseId")({
  head: () => ({ meta: [{ title: "Resposta em PDF — Métrica Humana" }] }),
  component: RespostaPdfPage,
});

function RespostaPdfPage() {
  const { versionId, responseId } = Route.useParams();
  const fn = useServerFn(getIndividualResponseParaPdf);
  const { data, isLoading, error } = useQuery({
    queryKey: ["individual-response-pdf", responseId],
    queryFn: () => fn({ data: { response_id: responseId } }),
  });
  const brand = useBrand();

  if (isLoading)
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Não foi possível abrir esta resposta."}
      </div>
    );
  }

  return (
    <div className="report-root mx-auto max-w-3xl space-y-6 p-6 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="flex items-center justify-between print:hidden">
        <Link
          to="/testes/$versionId/respostas"
          params={{ versionId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Voltar
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> Baixar PDF
        </Button>
      </div>

      <div className="report-section rounded-xl bg-card p-6 ring-1 ring-black/5 print:rounded-none print:ring-0">
        <ReportBrandHeader brand={paraReportBrand(brand)} />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Respostas do teste
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {data.person?.full_name ?? "—"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.version?.title}</p>
        {data.submitted_at && (
          <p className="mt-1 text-xs text-muted-foreground">
            Respondeu em{" "}
            {new Date(data.submitted_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </p>
        )}
      </div>

      <div className="report-section space-y-4 rounded-xl bg-card p-6 ring-1 ring-black/5 print:rounded-none print:ring-0">
        {data.questions.map((q) => (
          <div
            key={q.id}
            className="space-y-1 border-b border-black/5 pb-3 last:border-0 last:pb-0"
          >
            <p className="text-xs font-medium text-muted-foreground">{q.prompt}</p>
            <p className="text-sm">{formatarResposta(q)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
