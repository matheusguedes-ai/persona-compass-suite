import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertCircle, ArrowUp, ArrowDown } from "lucide-react";

export type Question = { id: string; type: string; prompt: string; required: boolean; config: Record<string, unknown> | null };
export type Option = { id: string; question_id: string; label: string };
export type ResponsePayload = {
  submitted: false;
  kind: "self" | "observer";
  subject_name: string | null;
  response: { id: string; submitted_at: string | null; test_versions: { title: string; description: string | null } | null; people: { full_name: string } | null };
  questions: Question[];
  options: Option[];
};
export type ResultDim = { id: string; key: string; label: string; color: string | null; points: number };
export type PerDimBand = { dimension_id: string; label: string; color: string | null; mode: "natural" | "adaptado"; points: number; normalized: number | null; band: { title: string; description: string | null } | null };
export type Result = {
  totals: Record<string, number>;
  by_dimension?: ResultDim[];
  natural?: Record<string, number>;
  adaptado?: Record<string, number>;
  normalized?: Record<string, { natural: number; adaptado: number }>;
  per_dimension_bands?: PerDimBand[];
  dominant: { key: string; label: string; color: string | null } | null;
  band: { title: string; description: string | null } | null;
};

/**
 * Formulário de resposta reutilizável: usado tanto na rota /responder/$id
 * quanto em cada etapa da bateria unificada (/bateria/$id).
 */
/** O avaliado não tem como saber o que é "not_found" — traduzimos. */
const MENSAGEM_ERRO: Record<string, string> = {
  not_found:
    "Este link não está mais disponível. Ele pode ter sido cancelado ou substituído — peça um novo ao seu mentor.",
  expired: "Este link expirou. Peça um novo ao seu mentor.",
  canceled: "Este link foi cancelado pelo seu mentor. Se isso não era esperado, fale com ele.",
};

export function ResponseForm({
  responseId,
  onSubmitted,
  onAlreadySubmitted,
  submitLabel = "Enviar respostas",
  showHeader = true,
  onBrand,
}: {
  responseId: string;
  onSubmitted: (json: { observer?: boolean; result?: Result }) => void;
  onAlreadySubmitted?: () => void;
  submitLabel?: string;
  showHeader?: boolean;
  /**
   * A marca do mentor, assim que o endpoint responde.
   *
   * O endpoint SEMPRE devolveu `brand` e este componente ignorava. Quem
   * respondia o teste — a tela mais vista da plataforma — via a marca padrão e
   * nenhum selo de empresa, na única página que a pessoa abre sem nunca ter
   * ouvido falar de quem operou a avaliação.
   *
   * Sobe por callback e não é aplicada aqui porque o formulário é usado dentro
   * da bateria também, e lá a marca já foi aplicada pela página de fora —
   * aplicar de novo seria duas fontes mandando na mesma coisa.
   */
  onBrand?: (brand: unknown) => void;
}) {
  const [payload, setPayload] = useState<ResponsePayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [raterName, setRaterName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPayload(null);
    setAnswers({});
    setError(null);
    fetch(`/api/public/response/${responseId}`)
      .then(async (r) => {
        if (!active) return;
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
          // A API devolve um código curto ("not_found"); quem está do outro lado
          // é o avaliado, que precisa de uma frase e de um caminho.
          setError(j.message ?? MENSAGEM_ERRO[j.error ?? ""] ?? "Não foi possível carregar o teste.");
          return;
        }
        const json = await r.json();
        if (!active) return;
        if (json?.submitted) { onBrand?.(json.brand ?? null); onAlreadySubmitted?.(); return; }
        onBrand?.(json.brand ?? null);
        setPayload(json);
        const init: Record<string, Record<string, unknown>> = {};
        for (const q of json.questions as Question[]) {
          if (q.type === "ranking" || q.type === "drag_order") {
            init[q.id] = {
              ordered_option_ids: (json.options as Option[]).filter((o) => o.question_id === q.id).map((o) => o.id),
            };
          }
        }
        setAnswers(init);
      })
      .catch(() => { if (active) setError("Falha de conexão. Verifique sua internet e tente novamente."); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseId]);

  const setAns = (qid: string, value: Record<string, unknown>) =>
    setAnswers((prev) => ({ ...prev, [qid]: value }));

  const submit = async () => {
    if (!payload) return;
    const isObserver = payload.kind === "observer";
    if (isObserver && raterName.trim().length === 0) {
      toast.error("Informe o seu nome antes de enviar.");
      return;
    }
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
        toast.error(q.type === "forced_choice"
          ? `Pergunta ${i + 1}: escolha uma opção em MAIS e outra em MENOS (diferentes).`
          : `Pergunta ${i + 1} é obrigatória: "${q.prompt || "sem título"}"`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const body = {
        ...(isObserver ? { rater_name: raterName.trim() } : {}),
        answers: Object.entries(answers).map(([question_id, value]) => ({ question_id, payload: value })),
      };
      const res = await fetch(`/api/public/response/${responseId}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error ?? "Erro ao enviar"); return; }
      onSubmitted(json);
    } catch {
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <AlertCircle className="mx-auto size-10 text-amber-500" />
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (!payload) return <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>;

  const v = payload.response.test_versions;
  const isObserver = payload.kind === "observer";
  const subject = payload.subject_name ?? "a pessoa avaliada";

  return (
    <div className="space-y-4">
      {showHeader && (
        <header className="rounded-xl bg-card p-6 ring-1 ring-black/5">
          <h1 className="text-2xl font-semibold tracking-tight">{v?.title}</h1>
          {v?.description && <p className="mt-2 text-sm text-muted-foreground">{v.description}</p>}
          {!isObserver && payload.response.people && (
            <p className="mt-3 text-xs text-muted-foreground">Respondendo como: <strong>{payload.response.people.full_name}</strong></p>
          )}
        </header>
      )}

      {isObserver && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
          <p className="text-sm">
            Você foi convidado(a) a descrever como percebe <strong>{subject}</strong>. Responda pensando no
            comportamento OBSERVADO, não no seu.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="rater-name" className="text-sm font-medium">Seu nome <span className="text-destructive">*</span></Label>
            <Input id="rater-name" value={raterName} onChange={(e) => setRaterName(e.target.value)} placeholder="Como você se chama?" />
          </div>
        </div>
      )}

      {payload.questions.map((q, i) => {
        const opts = payload.options.filter((o) => o.question_id === q.id);
        return (
          <div key={q.id} className="rounded-xl bg-card p-5 ring-1 ring-black/5">
            <Label className="text-sm font-medium">
              {i + 1}. {q.prompt} {q.required && <span className="text-destructive">*</span>}
            </Label>
            <div className="mt-3">
              <QuestionField q={q} options={opts} value={answers[q.id]} onChange={(val) => setAns(q.id, val)} subjectLabel={isObserver ? subject : null} />
            </div>
          </div>
        );
      })}

      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? "Enviando…" : submitLabel}
      </Button>
    </div>
  );
}

function QuestionField({ q, options, value, onChange, subjectLabel }: {
  q: Question; options: Option[];
  value: Record<string, unknown> | undefined;
  onChange: (v: Record<string, unknown>) => void;
  subjectLabel?: string | null;
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
        <p className="text-[11px] text-muted-foreground">
          Escolha a frase que <strong>MAIS</strong> e a que <strong>MENOS</strong> descreve{" "}
          {subjectLabel ? <strong>{subjectLabel}</strong> : "você"} (não podem ser a mesma).
        </p>
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
