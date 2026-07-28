import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, LayoutDashboard } from "lucide-react";
import { CriarContaNoFim } from "@/components/criar-conta-no-fim";
import { ResponseForm } from "@/components/response-form";
import type { Result, ResultDim, PerDimBand } from "@/components/response-form";

export const Route = createFileRoute("/responder/$responseId")({
  head: () => ({ meta: [{ title: "Responder teste" }, { name: "robots", content: "noindex" }] }),
  component: ResponderPage,
});

function ResponderPage() {
  const { responseId } = Route.useParams();
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [observerDone, setObserverDone] = useState(false);

  if (observerDone) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        <p className="mt-3 text-lg font-medium">Obrigado! Sua percepção foi registrada.</p>
      </div>
    );
  }
  if (alreadySubmitted && !result) {
    return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">Esta resposta já foi enviada. Obrigado!</div>;
  }
  if (result) return <ResultView result={result} responseId={responseId} />;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <ResponseForm
        responseId={responseId}
        onAlreadySubmitted={() => setAlreadySubmitted(true)}
        onSubmitted={(json) => {
          if (json.observer) { setObserverDone(true); return; }
          if (json.result) setResult(json.result);
        }}
      />
    </div>
  );
}

function ResultView({ result, responseId }: { result: Result; responseId: string }) {
  const entries = useMemo(() => Object.entries(result.totals).sort(([, a], [, b]) => b - a), [result.totals]);
  const perDim = result.per_dimension_bands ?? [];
  const naturalBands = perDim.filter((p) => p.mode === "natural");
  const adaptadoBands = perDim.filter((p) => p.mode === "adaptado");
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="rounded-xl bg-card p-6 ring-1 ring-black/5 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        <h1 className="mt-2 text-2xl font-semibold">Respostas enviadas!</h1>
        {result.dominant && (
          <p className="mt-2 text-sm text-muted-foreground">Perfil dominante: <strong style={{ color: result.dominant.color ?? undefined }}>{result.dominant.label}</strong></p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {result.normalized && (
            <Button asChild>
              <Link to="/relatorio/$responseId" params={{ responseId }}>Ver relatório completo</Link>
            </Button>
          )}
          {/* Onde ficam os outros testes liberados para esta pessoa. Sem conta,
              o painel pede login — que é justamente o caminho de quem quer
              responder aos poucos em vez de tudo de uma vez. */}
          <Button variant="outline" asChild>
            <a href="/aluno">
              <LayoutDashboard className="size-3.5" /> Ir para o meu painel
            </a>
          </Button>
        </div>
      </div>
      <CriarContaNoFim responseId={responseId} />

      {result.band && (
        <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
          <h2 className="text-lg font-semibold">{result.band.title}</h2>
          {result.band.description && <p className="mt-2 text-sm text-muted-foreground">{result.band.description}</p>}
        </div>
      )}
      {naturalBands.length > 0 && (
        <PerDimSection title="Perfil natural" items={naturalBands} />
      )}
      {adaptadoBands.length > 0 && (
        <PerDimSection title="Perfil adaptado" items={adaptadoBands} />
      )}
      <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pontuação por dimensão</h3>
        <div className="mt-3 space-y-2">
          {(result.by_dimension && result.by_dimension.length > 0
            ? result.by_dimension
            : entries.map(([id, points]) => ({ id, key: "", label: id, color: null, points } as ResultDim))
          ).map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-block size-2 rounded-full" style={{ background: d.color ?? "var(--muted-foreground)" }} />
                <span>{d.label}</span>
                {d.key && <span className="text-[10px] uppercase text-muted-foreground">({d.key})</span>}
              </span>
              <span className="font-semibold">{d.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PerDimSection({ title, items }: { title: string; items: PerDimBand[] }) {
  return (
    <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="mt-3 space-y-3">
        {items.map((d) => (
          <div key={`${d.dimension_id}-${d.mode}`} className="rounded-lg border border-input p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-block size-2 rounded-full" style={{ background: d.color ?? "var(--muted-foreground)" }} />
                <span className="font-medium">{d.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {d.points} pts{d.normalized != null ? ` · ${Math.round(d.normalized)}/100` : ""}
              </span>
            </div>
            {d.band && (
              <div className="mt-2">
                <p className="text-sm font-semibold">{d.band.title}</p>
                {d.band.description && <p className="mt-1 text-xs text-muted-foreground">{d.band.description}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}