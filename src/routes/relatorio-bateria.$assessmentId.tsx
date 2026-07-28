import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useApplyBrand } from "@/lib/brand";
import { usePodeBaixar } from "@/lib/pode-baixar";
import {
  ActionPlanSection,
  IntroSection,
  PLANO_ACAO,
  PLANO_ACAO_GENERICO,
  PRINT_CSS,
  ReportBody,
  AvisoDeConfiabilidade,
  ReportBrandHeader,
  ReportFooter,
  Section,
  type JungPares,
  type Report,
} from "@/components/report/sections";

export const Route = createFileRoute("/relatorio-bateria/$assessmentId")({
  head: () => ({
    meta: [
      { title: "Relatório completo" },
      { name: "description", content: "Relatório unificado com todos os inventários respondidos pelo avaliado." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Relatório completo" },
      { property: "og:description", content: "Relatório unificado com todos os inventários respondidos pelo avaliado." },
    ],
  }),
  component: RelatorioBateriaPage,
});

type BatteryReport = {
  assessment_id: string;
  brand?: Report["brand"];
  settings?: Report["settings"];
  person_name: string | null;
  submitted_at: string;
  duration: string | null;
  total_parts: number;
  done_parts: number;
  pending_titles: string[];
  mbti_real: { tipo: string; pares: JungPares } | null;
  parts: Array<Report & { assessment_sort: number }>;
};

function RelatorioBateriaPage() {
  const { assessmentId } = Route.useParams();
  const [data, setData] = useState<BatteryReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/report-bateria/${assessmentId}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) { setError(json.error ?? "Relatório indisponível."); return; }
        setData(json as BatteryReport);
      })
      .catch(() => setError("Falha de conexão. Tente novamente."));
  }, [assessmentId]);

  // A marca é a do mentor dono do link, não a de quem abre (ninguém está logado).
  useApplyBrand(data?.brand);
  // Todas as etapas são do mesmo avaliado: checar a primeira basta.
  const podeBaixar = usePodeBaixar(data?.parts?.[0]?.response_id);

  if (error) return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">{error}</div>;
  if (!data) return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">Carregando relatório…</div>;

  const discPart = data.parts.find((p) => p.is_disc);
  // O plano de ação é salvo na etapa principal (DISC quando houver).
  const planResponseId = discPart?.response_id ?? data.parts[0]?.response_id ?? "";
  const planQuestions = discPart ? PLANO_ACAO : PLANO_ACAO_GENERICO;

  return (
    <div className="report-root mx-auto max-w-3xl space-y-6 p-6 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>

      {(podeBaixar ?? data.settings?.allow_pdf !== false) && (
        <div className="flex justify-end print:hidden">
          <Button onClick={() => window.print()}><Printer className="size-4" /> Baixar PDF</Button>
        </div>
      )}

      {/* Capa unificada */}
      <Section>
        <ReportBrandHeader brand={data.brand} />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Relatório completo</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{data.person_name ?? "Avaliado"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.parts.map((p) => p.test_title).filter(Boolean).join(" · ")}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Concluído em</dt>
            <dd className="font-medium">{new Date(data.submitted_at).toLocaleDateString("pt-BR")}</dd>
          </div>
          {data.duration && (
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Tempo total</dt>
              <dd className="font-medium">{data.duration}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Inventários</dt>
            <dd className="font-medium">{data.done_parts} de {data.total_parts}</dd>
          </div>
        </dl>
        {data.pending_titles.length > 0 && (
          <p className="mt-5 rounded-lg border border-input bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            Este relatório cobre apenas os inventários já concluídos. Ainda pendente(s):{" "}
            <strong className="text-foreground">{data.pending_titles.join(", ")}</strong>. As seções correspondentes
            aparecerão automaticamente quando forem respondidas.
          </p>
        )}
      </Section>

      {/* Basta uma etapa preenchida no automático para valer a ressalva. */}
      <AvisoDeConfiabilidade
        q={data.parts.map((p) => p.qualidade).filter(Boolean).sort((a, b) => {
          const peso = { baixa: 0, media: 1, alta: 2 } as const;
          return peso[a!.nivel] - peso[b!.nivel];
        })[0] ?? null}
      />

      {/* Sumário do que foi respondido */}
      <Section>
        <h2 className="text-lg font-semibold">O que foi avaliado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada inventário abaixo foi respondido por você e gera uma seção própria neste relatório.
        </p>
        <ol className="mt-4 space-y-2">
          {data.parts.map((p, i) => (
            <li key={p.response_id ?? i} className="flex items-baseline justify-between gap-3 rounded-lg border border-input p-3 text-sm">
              <span className="font-medium">{i + 1}. {p.test_title}</span>
              <span className="text-xs text-muted-foreground">
                {p.is_disc && p.profile ? `perfil ${p.profile}` : p.factors[0] ? `${p.factors.length} dimensões` : ""}
                {p.duration ? ` · ${p.duration}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {/* Uma seção completa por inventário respondido */}
      {data.parts.map((part, idx) => (
        <div key={part.response_id ?? idx} className="space-y-6">
          <Section className="border-l-4 border-primary">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Parte {idx + 1} de {data.parts.length}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{part.test_title}</h2>
            {part.test_description && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{part.test_description}</p>
            )}
          </Section>

          {/* Introdução metodológica só na primeira ocorrência de cada tipo */}
          {idx === 0 ? <IntroSection isDisc={part.is_disc !== false} /> : null}

          <ReportBody data={part} mbtiReal={part.is_disc ? data.mbti_real : null} showIntro={false} />
        </div>
      ))}

      {planResponseId && !(data.settings?.hidden_blocks ?? []).includes("plano_acao") && (
        <ActionPlanSection responseId={planResponseId} questions={planQuestions} />
      )}

      <ReportFooter brand={data.brand} />
    </div>
  );
}
