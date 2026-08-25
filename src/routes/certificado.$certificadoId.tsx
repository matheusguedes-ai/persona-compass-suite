/**
 * #221 F2 — o certificado em PDF. Mesmo mecanismo do resto da plataforma:
 * impressão do navegador com PRINT_CSS (ver relatorio.$responseId.tsx e
 * _app.testes.$versionId.pdf.$responseId.tsx da #280) — nenhuma biblioteca
 * de PDF nova.
 *
 * Rota de RAIZ, de propósito — fora de `_app`/`aluno`, sem o chrome do
 * dashboard (sidebar, header, selo). O certificado é "este conteúdo e nada
 * mais" (requisito 4); nenhum componente do layout do painel tem
 * `print:hidden`, então herdar aquele chrome imprimiria menu e cabeçalho
 * junto. Por estar fora do BrandProvider do layout, esta página abre o
 * próprio — `useBrand()` continua resolvendo a marca certa (a do mentor
 * dono do certificado), do mesmo jeito que já resolve para o aluno logado
 * em qualquer outra tela, ver brand.tsx.
 *
 * Autorização é só RLS: `getCertificadoParaPdf` lê com o cliente autenticado
 * de sempre — a policy de SELECT de `certificados` já decide quem enxerga
 * (o próprio dono do certificado, ou a conta que o emitiu). Sem percentual
 * nenhum no que a função devolve, de propósito — não é o servidor
 * escondendo na tela, é o dado nem chegando ao navegador.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCertificadoParaPdf } from "@/lib/certificados.functions";
import { Button } from "@/components/ui/button";
import { PRINT_CSS, ReportBrandHeader, type ReportBrand } from "@/components/report/sections";
import { BrandProvider, useBrand, type Brand } from "@/lib/brand";
import { ArrowLeft, Printer } from "lucide-react";

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

export const Route = createFileRoute("/certificado/$certificadoId")({
  head: () => ({ meta: [{ title: "Certificado de conclusão — Métrica Humana" }] }),
  component: () => (
    <BrandProvider>
      <CertificadoPage />
    </BrandProvider>
  ),
});

function CertificadoPage() {
  const { certificadoId } = Route.useParams();
  const fn = useServerFn(getCertificadoParaPdf);
  const { data, isLoading, error } = useQuery({
    queryKey: ["certificado-pdf", certificadoId],
    queryFn: () => fn({ data: { certificado_id: certificadoId } }),
  });
  const brand = useBrand();

  if (isLoading)
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Certificado não encontrado."}
      </div>
    );
  }

  return (
    <div className="report-root mx-auto max-w-3xl space-y-6 p-6 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="flex items-center justify-between print:hidden">
        <Link
          to="/aluno"
          search={{ ver: undefined }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Voltar
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> Baixar PDF
        </Button>
      </div>

      <div className="report-section rounded-2xl border-4 border-double border-primary/30 bg-card p-12 text-center ring-1 ring-black/5 print:rounded-none print:border-2 print:ring-0">
        <ReportBrandHeader brand={paraReportBrand(brand)} />
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Certificado de Conclusão
        </p>
        <p className="mt-8 text-sm text-muted-foreground">Certificamos que</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.nome_pessoa}</h1>
        <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
          concluiu com sucesso <strong className="text-foreground">{data.nome_item}</strong>.
        </p>
        <p className="mt-8 text-sm text-muted-foreground">
          Emitido em {new Date(data.emitido_em).toLocaleDateString("pt-BR")}
        </p>
        <p className="mt-10 text-[11px] text-muted-foreground">
          Código de verificação: <span className="font-mono">{data.codigo}</span>
        </p>
      </div>
    </div>
  );
}
