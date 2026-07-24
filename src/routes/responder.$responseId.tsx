import { createFileRoute } from "@tanstack/react-router";
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
  response: { id: string; submitted_at: string | null; test_versions: { title: string; description: string | null } | null; people: { full_name: string; email: string } | null };
  questions: Question[];
  options: Option[];
};
type Result = { totals: Record<string, number>; dominant: { key: string; label: string; color: string | null } | null; band: { title: string; description: string | null } | null };

function ResponderPage() {
  const { responseId } = Route.useParams();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/response/${responseId}`).then(async (r) => {
      if (!r.ok) { setError((await r.json()).error ?? "Erro"); return; }
      setPayload(await r.json());
    });
  }, [responseId]);

  const setAns = (qid: string, payload: Record<string, unknown>) =>
    setAnswers((prev) => ({ ...prev, [qid]: payload }));

  const submit = async () => {
    if (!payload) return;
    setSubmitting(true);
    const body = { answers: Object.entries(answers).map(([question_id, payload]) => ({ question_id, payload })) };
    const res = await fetch(`/api/public/response/${responseId}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    setSubmitting(false);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Erro ao enviar"); return; }
    setResult(json.result);
  };

  if (error) return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">{error}</div>;
  if (!payload) return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (payload.response.submitted_at && !result) {
    return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">Esta resposta já foi enviada. Obrigado!</div>;
  }
  if (result) return <ResultView result={result} />;

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
  return <Textarea disabled placeholder="Tipo desconhecido" />;
}

function ResultView({ result }: { result: Result }) {
  const entries = useMemo(() => Object.entries(result.totals).sort(([, a], [, b]) => b - a), [result.totals]);
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="rounded-xl bg-card p-6 ring-1 ring-black/5 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        <h1 className="mt-2 text-2xl font-semibold">Respostas enviadas!</h1>
        {result.dominant && (
          <p className="mt-2 text-sm text-muted-foreground">Perfil dominante: <strong style={{ color: result.dominant.color ?? undefined }}>{result.dominant.label}</strong></p>
        )}
      </div>
      {result.band && (
        <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
          <h2 className="text-lg font-semibold">{result.band.title}</h2>
          {result.band.description && <p className="mt-2 text-sm text-muted-foreground">{result.band.description}</p>}
        </div>
      )}
      <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pontuação por dimensão</h3>
        <div className="mt-3 space-y-2">
          {entries.map(([id, pts]) => (
            <div key={id} className="flex items-center justify-between text-sm">
              <span className="font-mono text-xs text-muted-foreground">{id.slice(0, 8)}</span>
              <span className="font-semibold">{pts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}