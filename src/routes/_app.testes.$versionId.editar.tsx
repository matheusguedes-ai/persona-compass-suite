import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  getTestVersion, updateTestVersion,
  createQuestion, updateQuestion, deleteQuestion, reorderQuestions,
  createOption, updateOption, deleteOption, setOptionScore,
  upsertDimension, deleteDimension,
  upsertBand, deleteBand,
} from "@/lib/tests.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  CheckSquare, Circle, SlidersHorizontal, ListOrdered, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import type { QuestionType } from "@/lib/tests.functions";

type UpdQ = { id: string; prompt?: string; helper?: string | null; required?: boolean; type?: QuestionType; config?: Record<string, unknown>; sort_order?: number };
type UpdO = { id: string; label?: string; value?: string | null; sort_order?: number };
type UpsDim = { id?: string; version_id: string; key: string; label: string; description?: string | null; color?: string | null; sort_order?: number };
type UpsBand = { id?: string; version_id: string; dimension_id?: string | null; min_score: number; max_score: number; title: string; description?: string | null; sort_order?: number };

export const Route = createFileRoute("/_app/testes/$versionId/editar")({
  head: () => ({ meta: [{ title: "Editar teste — Métrica Humana" }] }),
  component: EditorPage,
});

const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Múltipla escolha",
  checkboxes: "Caixas de seleção",
  linear_scale: "Escala linear",
  ranking: "Classificação",
  drag_order: "Arrastar para ordenar",
};
const TYPE_ICON: Record<QuestionType, React.ComponentType<{ className?: string }>> = {
  multiple_choice: Circle,
  checkboxes: CheckSquare,
  linear_scale: SlidersHorizontal,
  ranking: ListOrdered,
  drag_order: GripVertical,
};

function EditorPage() {
  const { versionId } = Route.useParams();
  const qc = useQueryClient();

  const getFn = useServerFn(getTestVersion);
  const updV = useServerFn(updateTestVersion);
  const createQFn = useServerFn(createQuestion);
  const updQFn = useServerFn(updateQuestion);
  const delQFn = useServerFn(deleteQuestion);
  const reorderFn = useServerFn(reorderQuestions);
  const createOFn = useServerFn(createOption);
  const updOFn = useServerFn(updateOption);
  const delOFn = useServerFn(deleteOption);
  const scoreFn = useServerFn(setOptionScore);
  const upsertDimFn = useServerFn(upsertDimension);
  const delDimFn = useServerFn(deleteDimension);
  const upsertBandFn = useServerFn(upsertBand);
  const delBandFn = useServerFn(deleteBand);

  const { data, isLoading } = useQuery({
    queryKey: ["test-version", versionId],
    queryFn: () => getFn({ data: { id: versionId } }),
  });

  const inv = () => qc.invalidateQueries({ queryKey: ["test-version", versionId] });

  const updVersion = useMutation({
    mutationFn: (patch: { title?: string; description?: string | null; is_published?: boolean }) =>
      updV({ data: { id: versionId, ...patch } }),
    onSuccess: () => { inv(); toast.success("Salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addQ = useMutation({
    mutationFn: (type: QuestionType) => createQFn({ data: { version_id: versionId, type } }),
    onSuccess: inv,
    onError: (e: Error) => toast.error(e.message),
  });
  const updQ = useMutation({ mutationFn: (v: UpdQ) => updQFn({ data: v }), onSuccess: inv });
  const delQ = useMutation({ mutationFn: (id: string) => delQFn({ data: { id } }), onSuccess: inv });
  const reorderQ = useMutation({
    mutationFn: (ids: string[]) => reorderFn({ data: { version_id: versionId, ordered_ids: ids } }),
    onSuccess: inv,
  });

  const addO = useMutation({ mutationFn: (question_id: string) => createOFn({ data: { question_id } }), onSuccess: inv });
  const updO = useMutation({ mutationFn: (v: UpdO) => updOFn({ data: v }), onSuccess: inv });
  const delO = useMutation({ mutationFn: (id: string) => delOFn({ data: { id } }), onSuccess: inv });
  const setScore = useMutation({
    mutationFn: (v: { option_id: string; dimension_id: string; points: number }) => scoreFn({ data: v }),
    onSuccess: inv,
  });

  const upsertDim = useMutation({ mutationFn: (v: UpsDim) => upsertDimFn({ data: v }), onSuccess: inv });
  const delDim = useMutation({ mutationFn: (id: string) => delDimFn({ data: { id } }), onSuccess: inv });
  const upsertB = useMutation({ mutationFn: (v: UpsBand) => upsertBandFn({ data: v }), onSuccess: inv });
  const delB = useMutation({ mutationFn: (id: string) => delBandFn({ data: { id } }), onSuccess: inv });

  if (isLoading || !data) return <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
  const { version, dimensions, questions, options, scores, bands } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/testes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Voltar
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
            <Switch checked={version.is_published} onCheckedChange={(v) => updVersion.mutate({ is_published: v })} />
            <span className="text-xs font-medium">{version.is_published ? "Publicado" : "Rascunho"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* CANVAS */}
        <div className="space-y-4">
          <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
            <Input
              defaultValue={version.title}
              onBlur={(e) => e.target.value !== version.title && updVersion.mutate({ title: e.target.value })}
              className="border-0 border-b border-transparent bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:border-primary focus-visible:ring-0"
            />
            <Textarea
              defaultValue={version.description ?? ""}
              placeholder="Descrição do teste (opcional)"
              onBlur={(e) => e.target.value !== (version.description ?? "") && updVersion.mutate({ description: e.target.value || null })}
              className="mt-2 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
              rows={2}
            />
          </div>

          {questions.map((q, idx) => {
            const qOptions = options.filter((o) => o.question_id === q.id);
            const Icon = TYPE_ICON[q.type as QuestionType];
            return (
              <div key={q.id} className="rounded-xl bg-card p-5 ring-1 ring-black/5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 pt-2">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={() => {
                        const ids = questions.map((x) => x.id);
                        [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                        reorderQ.mutate(ids);
                      }}
                    ><ChevronUp className="size-4" /></button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === questions.length - 1}
                      onClick={() => {
                        const ids = questions.map((x) => x.id);
                        [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                        reorderQ.mutate(ids);
                      }}
                    ><ChevronDown className="size-4" /></button>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <Select value={q.type} onValueChange={(v) => updQ.mutate({ id: q.id, type: v as QuestionType })}>
                        <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
                            <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="ml-auto flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch checked={q.required} onCheckedChange={(v) => updQ.mutate({ id: q.id, required: v })} />
                          Obrigatória
                        </label>
                        <Button size="sm" variant="ghost" onClick={() => delQ.mutate(q.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      defaultValue={q.prompt}
                      placeholder={`Pergunta ${idx + 1}`}
                      onBlur={(e) => e.target.value !== q.prompt && updQ.mutate({ id: q.id, prompt: e.target.value })}
                      rows={2}
                      className="text-sm"
                    />

                    {(q.type === "multiple_choice" || q.type === "checkboxes" || q.type === "ranking" || q.type === "drag_order") && (
                      <div className="space-y-2">
                        {qOptions.map((o) => {
                          const optScores = scores.filter((s) => s.option_id === o.id);
                          return (
                            <div key={o.id} className="rounded-lg bg-muted/40 p-3 ring-1 ring-black/5">
                              <div className="flex items-center gap-2">
                                <Icon className="size-3.5 text-muted-foreground" />
                                <Input
                                  defaultValue={o.label}
                                  placeholder="Opção"
                                  onBlur={(e) => e.target.value !== o.label && updO.mutate({ id: o.id, label: e.target.value })}
                                  className="h-8 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
                                />
                                <Button size="sm" variant="ghost" onClick={() => delO.mutate(o.id)}>
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                              {dimensions.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pontos:</span>
                                  {dimensions.map((d) => {
                                    const s = optScores.find((x) => x.dimension_id === d.id);
                                    return (
                                      <div key={d.id} className="flex items-center gap-1 rounded-full bg-background px-2 py-0.5 ring-1 ring-black/5">
                                        <span className="size-2 rounded-full" style={{ background: d.color ?? "var(--muted-foreground)" }} />
                                        <span className="text-[11px] font-medium">{d.key}</span>
                                        <Input
                                          type="number"
                                          defaultValue={s?.points ?? 0}
                                          onBlur={(e) => {
                                            const points = Number(e.target.value);
                                            if (points !== (s?.points ?? 0)) {
                                              setScore.mutate({ option_id: o.id, dimension_id: d.id, points });
                                            }
                                          }}
                                          className="h-6 w-12 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <Button size="sm" variant="ghost" onClick={() => addO.mutate(q.id)}>
                          <Plus className="size-3" /> Adicionar opção
                        </Button>
                        {(q.type === "ranking" || q.type === "drag_order") && (
                          <p className="text-[11px] text-muted-foreground">
                            Peso da posição: os pontos de cada opção são multiplicados por (peso_topo − índice). Ajuste em <em>config.top_weight</em>.
                          </p>
                        )}
                      </div>
                    )}

                    {q.type === "linear_scale" && (
                      <LinearScaleEditor
                        question={q}
                        dimensions={dimensions}
                        onUpdate={(config) => updQ.mutate({ id: q.id, config })}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="rounded-xl bg-card p-4 ring-1 ring-dashed ring-black/10">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => {
                const Icon = TYPE_ICON[t];
                return (
                  <Button key={t} size="sm" variant="outline" onClick={() => addQ.mutate(t)}>
                    <Icon className="size-3" /> {TYPE_LABEL[t]}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SIDE PANEL */}
        <div className="lg:sticky lg:top-6 lg:h-fit">
          <Tabs defaultValue="dims">
            <TabsList className="w-full">
              <TabsTrigger value="dims" className="flex-1">Dimensões</TabsTrigger>
              <TabsTrigger value="bands" className="flex-1">Resultados</TabsTrigger>
            </TabsList>
            <TabsContent value="dims" className="mt-3 space-y-2">
              {dimensions.map((d) => (
                <div key={d.id} className="rounded-lg bg-card p-3 ring-1 ring-black/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ background: d.color ?? "var(--muted-foreground)" }} />
                    <Input defaultValue={d.key} className="h-7 w-16 text-xs" onBlur={(e) =>
                      e.target.value !== d.key && upsertDim.mutate({ ...d, key: e.target.value })
                    } />
                    <Input defaultValue={d.label} className="h-7 flex-1 text-xs" onBlur={(e) =>
                      e.target.value !== d.label && upsertDim.mutate({ ...d, label: e.target.value })
                    } />
                    <Button size="sm" variant="ghost" onClick={() => delDim.mutate(d.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                  <Input defaultValue={d.color ?? ""} placeholder="#3b82f6" className="h-7 text-xs" onBlur={(e) =>
                    e.target.value !== (d.color ?? "") && upsertDim.mutate({ ...d, color: e.target.value })
                  } />
                </div>
              ))}
              <NewDimension versionId={versionId} onCreate={(v) => upsertDim.mutate(v)} nextOrder={dimensions.length + 1} />
            </TabsContent>

            <TabsContent value="bands" className="mt-3 space-y-2">
              {bands.map((b) => (
                <div key={b.id} className="rounded-lg bg-card p-3 ring-1 ring-black/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={b.dimension_id ?? "__total__"}
                      onValueChange={(v) => upsertB.mutate({ ...b, dimension_id: v === "__total__" ? null : v })}
                    >
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__total__">Score total</SelectItem>
                        {dimensions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.label} ({d.key})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => delB.mutate(b.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" defaultValue={b.min_score} className="h-7 text-xs" onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (n !== Number(b.min_score)) upsertB.mutate({ ...b, min_score: n });
                    }} />
                    <Input type="number" defaultValue={b.max_score} className="h-7 text-xs" onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (n !== Number(b.max_score)) upsertB.mutate({ ...b, max_score: n });
                    }} />
                  </div>
                  <Input defaultValue={b.title} className="h-7 text-sm" onBlur={(e) =>
                    e.target.value !== b.title && upsertB.mutate({ ...b, title: e.target.value })
                  } />
                  <Textarea defaultValue={b.description ?? ""} rows={2} className="text-xs" onBlur={(e) =>
                    e.target.value !== (b.description ?? "") && upsertB.mutate({ ...b, description: e.target.value })
                  } />
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-full" onClick={() => upsertB.mutate({
                version_id: versionId, dimension_id: dimensions[0]?.id ?? null,
                min_score: 0, max_score: 100, title: "Nova faixa", sort_order: bands.length + 1,
              })}>
                <Plus className="size-3" /> Adicionar faixa
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function NewDimension({ versionId, onCreate, nextOrder }: {
  versionId: string;
  onCreate: (v: { version_id: string; key: string; label: string; sort_order: number }) => void;
  nextOrder: number;
}) {
  const [key, setKey] = useState(""); const [label, setLabel] = useState("");
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2 ring-1 ring-dashed ring-black/10">
      <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Chave" className="h-7 w-16 text-xs" />
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo" className="h-7 flex-1 text-xs" />
      <Button size="sm" onClick={() => {
        if (!key.trim() || !label.trim()) return;
        onCreate({ version_id: versionId, key: key.trim(), label: label.trim(), sort_order: nextOrder });
        setKey(""); setLabel("");
      }}><Plus className="size-3" /></Button>
    </div>
  );
}

function LinearScaleEditor({ question, dimensions, onUpdate }: {
  question: { id: string; config: unknown };
  dimensions: Array<{ id: string; key: string; label: string }>;
  onUpdate: (config: Record<string, unknown>) => void;
}) {
  const cfg = (question.config ?? {}) as Record<string, unknown>;
  const [min, setMin] = useState(Number(cfg.min ?? 1));
  const [max, setMax] = useState(Number(cfg.max ?? 5));
  const [minLabel, setMinLabel] = useState(String(cfg.minLabel ?? "Discordo"));
  const [maxLabel, setMaxLabel] = useState(String(cfg.maxLabel ?? "Concordo"));
  const [dimKey, setDimKey] = useState(String(cfg.dimension_key ?? dimensions[0]?.key ?? ""));
  const save = () => onUpdate({ min, max, minLabel, maxLabel, dimension_key: dimKey });

  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3 ring-1 ring-black/5">
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-[10px]">Mínimo</Label><Input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} onBlur={save} className="h-8 text-xs" /></div>
        <div><Label className="text-[10px]">Máximo</Label><Input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} onBlur={save} className="h-8 text-xs" /></div>
        <div><Label className="text-[10px]">Rótulo mín.</Label><Input value={minLabel} onChange={(e) => setMinLabel(e.target.value)} onBlur={save} className="h-8 text-xs" /></div>
        <div><Label className="text-[10px]">Rótulo máx.</Label><Input value={maxLabel} onChange={(e) => setMaxLabel(e.target.value)} onBlur={save} className="h-8 text-xs" /></div>
      </div>
      <div>
        <Label className="text-[10px]">Dimensão pontuada</Label>
        <Select value={dimKey} onValueChange={(v) => { setDimKey(v); onUpdate({ min, max, minLabel, maxLabel, dimension_key: v }); }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione…" /></SelectTrigger>
          <SelectContent>
            {dimensions.map((d) => <SelectItem key={d.id} value={d.key}>{d.label} ({d.key})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <p className="text-[10px] text-muted-foreground">O valor escolhido pelo aluno soma nessa dimensão.</p>
    </div>
  );
}