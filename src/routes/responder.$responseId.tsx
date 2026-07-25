import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/responder/$responseId")({
  head: () => ({ meta: [{ title: "Responder teste" }, { name: "robots", content: "noindex" }] }),
  component: ResponderPage,
});

type Question = { id: string; type: string; prompt: string; required: boolean; config: Record<string, unknown> | null };
type Option = { id: string; question_id: string; label: string };
type Payload = {
  submitted: false;
  response: { id: string; submitted_at: string | null; test_versions: { title: string; description: string | null } | null; people: { full_name: string } | null };
  questions: Question[];
  options: Option[];
};
type ResultDim = { id: string; key: string; label: string; color: string | null; points: number };
type PerDimBand = { dimension_id: string; label: string; color: string | null; mode: "natural" | "adaptado"; points: number; normalized: number | null; band: { title: string; description: string | null } | null };
type Result = {
  totals: Record<string, number>;
  by_dimension?: ResultDim[];
  natural?: Record<string, number>;
  adaptado?: Record<string, number>;
  normalized?: Record<string, { natural: number; adaptado: number }>;
  per_dimension_bands?: PerDimBand[];
  dominant: { key: string; label: string; color: string | null } | null;
  band: { title: string; description: string | null } | null;
};

function ResponderPage() {
  const { responseId } = Route.useParams();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/response/${responseId}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError(j.error ?? "Não foi possível carregar o teste.");
          return;
        }
        const json = await r.json();
        if (json?.submitted) { setAlreadySubmitted(true); return; }
        setPayload(json);
        // Initialize ranking/drag_order answers with the shown order so submitting
        // without reordering still counts as a valid answer for required questions.
        const init: Record<string, Record<string, unknown>> = {};
        for (const q of json.questions as Question[]) {
          if (q.type === "ranking" || q.type === "drag_order") {
            const ordered = (json.options as Option[])
              .filter((o) => o.question_id === q.id)
              .map((o) => o.id);
            init[q.id] = { ordered_option_ids: ordered };
          }
        }
        setAnswers(init);
      })
      .catch(() => setError("Falha de conexão. Verifique sua internet e tente novamente."));
  }, [responseId]);

  const setAns = (qid: string, payload: Record<string, unknown>) =>
    setAnswers((prev) => ({ ...prev, [qid]: payload }));

  const submit = async () => {
    if (!payload) return;
    // Pre-validate required questions with a clear per-question message.
    for (let i = 0; i < payload.questions.length; i++) {
      const q = payload.questions[i];
      if (!q.required) continue;
      const a = answers[q.id];
      const ok =
        (q.type === "multiple_choice" && typeof a?.option_id === "string" && (a.option_id as string).length > 0) ||
        (q.type === "checkboxes" && Array.isArray(a?.option_ids) && (a!.option_ids as unknown[]).length > 0) ||
        (q.type === "linear_scale" && typeof a?.value === "number" && Number.isFinite(a.value as number)) ||
        ((q.type === "ranking" || q.type === "drag_order") && Array.isArray(a?.ordered_option_ids) && (a!.ordered_option_ids as unknown[]).length > 0) ||
        (q.type === "forced_choice" && typeof a?.most_option_id === "string" && typeof a?.least_option_id === "string" && a.most_option_id !== a.least_option_id);
      if (!ok) {
        const msg = q.type === "forced_choice"
          ? `Pergunta ${i + 1}: escolha uma opção em MAIS e outra em MENOS (diferentes).`
          : `Pergunta ${i + 1} é obrigatória: "${q.prompt || "sem título"}"`;
        toast.error(msg);
        return;
      }
    }
    setSubmitting(true);
    try {
      const body = { answers: Object.entries(answers).map(([question_id, payload]) => ({ question_id, payload })) };
      const res = await fetch(`/api/public/response/${responseId}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error ?? "Erro ao enviar"); return; }
      setResult(json.result);
    } catch {
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">{error}</div>;
  if (alreadySubmitted && !result) {
    return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">Esta resposta já foi enviada. Obrigado!</div>;
  }
  if (!payload) return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (result) return <ResultView result={result} responseId={responseId} />;

  const v = payload.response.test_versions;
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <header className="rounded-xl bg-card p-6 ring-1 ring-black/5">
        <h1 className="text-2xl font-semibold tracking-tight">{v?.title}</h1>
        {v?.description && <p className="mt-2 text-sm text-muted-foreground">{v.description}</p>}
        {payload.response.people && <p className="mt-3 text-xs text-muted-foreground">Respondendo como: <strong>{payload.response.people.full_name}</strong></p>}
      </header>

      {payload.questions.map((q, i) => {
        const opts = payload.options.filter((o) => o.question_id === q.id);
        return (
          <div key={q.id} className="rounded-xl bg-card p-5 ring-1 ring-black/5">
            <Label className="text-sm font-medium">
              {i + 1}. {q.prompt} {q.required && <span className="text-destructive">*</span>}
            </Label>
            <div className="mt-3">
              <QuestionField q={q} options={opts} value={answers[q.id]} onChange={(v) => setAns(q.id, v)} />
            </div>
          </div>
        );
      })}

      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? "Enviando…" : "Enviar respostas"}
      </Button>
    </div>
  );
}

function QuestionField({ q, options, value, onChange }: {
  q: Question; options: Option[];
  value: Record<string, unknown> | undefined;
  onChange: (v: Record<string, unknown>) => void;
}) {
  if (q.type === "multiple_choice") {
    const sel = value?.option_id as string | undefined;
    return (
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${sel === o.id ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40"}`}>
            <input type="radio" name={q.id} className="accent-primary" checked={sel === o.id} onChange={() => onChange({ option_id: o.id })} />
            {o.label}
          </label>
        ))}
      </div>
    );
  }
  if (q.type === "checkboxes") {
    const sel = new Set((value?.option_ids as string[] | undefined) ?? []);
    return (
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${sel.has(o.id) ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40"}`}>
            <input type="checkbox" className="accent-primary" checked={sel.has(o.id)} onChange={() => {
              const next = new Set(sel); next.has(o.id) ? next.delete(o.id) : next.add(o.id);
              onChange({ option_ids: Array.from(next) });
            }} />
            {o.label}
          </label>
        ))}
      </div>
    );
  }
  if (q.type === "linear_scale") {
    const cfg = (q.config ?? {}) as Record<string, unknown>;
    const min = Number(cfg.min ?? 1), max = Number(cfg.max ?? 5);
    const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const current = value?.value as number | undefined;
    return (
      <div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{String(cfg.minLabel ?? min)}</span>
          <span>{String(cfg.maxLabel ?? max)}</span>
        </div>
        <div className="mt-2 flex gap-2">
          {items.map((n) => (
            <button key={n} type="button" onClick={() => onChange({ value: n })}
              className={`h-10 flex-1 rounded-lg border text-sm font-medium transition-colors ${current === n ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-muted/40"}`}>
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (q.type === "ranking" || q.type === "drag_order") {
    const order = (value?.ordered_option_ids as string[] | undefined) ?? options.map((o) => o.id);
    const move = (idx: number, dir: -1 | 1) => {
      const next = [...order]; const j = idx + dir;
      if (j < 0 || j >= next.length) return;
      [next[idx], next[j]] = [next[j], next[idx]];
      onChange({ ordered_option_ids: next });
    };
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">Arraste (use as setas) do mais para o menos importante.</p>
        {order.map((oid, i) => {
          const o = options.find((x) => x.id === oid);
          if (!o) return null;
          return (
            <div key={oid} className="flex items-center gap-2 rounded-lg border border-input bg-background p-3 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{i + 1}º</span>
              <span className="flex-1">{o.label}</span>
              <button type="button" onClick={() => move(i, -1)} className="rounded p-1 hover:bg-muted"><ArrowUp className="size-3" /></button>
              <button type="button" onClick={() => move(i, 1)} className="rounded p-1 hover:bg-muted"><ArrowDown className="size-3" /></button>
            </div>
          );
        })}
      </div>
    );
  }
  if (q.type === "forced_choice") {
    const most = value?.most_option_id as string | undefined;
    const least = value?.least_option_id as string | undefined;
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">Escolha a que <strong>MAIS</strong> e a que <strong>MENOS</strong> descreve você (não podem ser a mesma).</p>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs text-muted-foreground">
          <span />
          <span className="w-16 text-center">Mais</span>
          <span className="w-16 text-center">Menos</span>
        </div>
        {options.map((o) => {
          const isMost = most === o.id;
          const isLeast = least === o.id;
          return (
            <div key={o.id} className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg border p-3 text-sm ${isMost ? "border-primary bg-primary/5" : isLeast ? "border-destructive/50 bg-destructive/5" : "border-input"}`}>
              <span className="flex-1">{o.label}</span>
              <div className="w-16 text-center">
                <input
                  type="radio"
                  name={`${q.id}-most`}
                  className="accent-primary"
                  checked={isMost}
                  onChange={() => onChange({ most_option_id: o.id, least_option_id: least === o.id ? undefined : least })}
                />
              </div>
              <div className="w-16 text-center">
                <input
                  type="radio"
                  name={`${q.id}-least`}
                  className="accent-destructive"
                  checked={isLeast}
                  onChange={() => onChange({ most_option_id: most === o.id ? undefined : most, least_option_id: o.id })}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return <Textarea disabled placeholder="Tipo desconhecido" />;
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
        {result.normalized && (
          <Button asChild className="mt-4">
            <Link to="/relatorio/$responseId" params={{ responseId }}>Ver relatório completo</Link>
          </Button>
        )}
      </div>
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