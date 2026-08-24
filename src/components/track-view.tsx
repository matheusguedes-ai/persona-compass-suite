/**
 * Uma trilha: player à esquerda, índice de módulos/aulas à direita.
 *
 * A mesma tela serve para assistir e para editar — quem pode editar recebe os
 * botões de montar módulo, aula e material. Isso evita manter duas telas em
 * sincronia e faz o autor ver exatamente o que o aluno vê.
 */
import { mensagemDeErro } from "@/lib/erro-legivel";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getTrack, saveModule, deleteModule, saveLesson, deleteLesson,
  saveMaterial, deleteMaterial, toggleLessonDone, updateTrack, deleteTrack,
  getTrackDestinos, setTrackDestinos,
  youtubeId, TIPOS_MATERIAL, PUBLICOS,
} from "@/lib/learning.functions";
import { QuemAcessa } from "@/components/quem-acessa";
import { ListaDeConcluidosTrilha } from "@/components/lista-de-concluidos";
import { RecortarImagem } from "@/components/recorte-imagem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Check, CircleCheck, ExternalLink, FileText, Image as ImageIcon, Lock, Paperclip,
  Pencil, Plus, Trash2, Video, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { assinarMeuEnvio } from "@/lib/preview-upload.functions";
import { erroDeUpload } from "@/lib/erro-de-upload";
import { bloqueadoNoPreview } from "@/lib/preview-mode";

type Material = { id: string; title: string; url: string; kind: string };
type Lesson = {
  id: string; title: string; description: string | null; video_url: string | null;
  duration_min: number | null; is_published: boolean; module_id: string; materials: Material[];
};
type Module = { id: string; title: string; description: string | null; lessons: Lesson[]; submodules?: Module[] };

const ICONE_MATERIAL: Record<string, typeof FileText> = {
  pdf: FileText, planilha: FileText, video: Video, audio: Video, link: ExternalLink, outro: Paperclip,
};

export function TrackView({
  trackId, base, previewPersonId = null,
}: {
  trackId: string;
  base: "/educacao" | "/aluno/educacao";
  /** Prévia "ver como aluno": o cadeado passa a valer o daquela pessoa. */
  previewPersonId?: string | null;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getTrack);
  const toggleFn = useServerFn(toggleLessonDone);
  const { data, isLoading } = useQuery({
    queryKey: ["track", trackId, previewPersonId],
    queryFn: () => getFn({ data: { id: trackId, preview_person_id: previewPersonId } }),
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["track", trackId] });

  const [aulaId, setAulaId] = useState<string | null>(null);
  const [editModulo, setEditModulo] = useState<{ id?: string; parent_id?: string | null } | null>(null);
  const [editAula, setEditAula] = useState<{ id?: string; module_id: string } | null>(null);
  const [editMaterial, setEditMaterial] = useState<{ id?: string; lesson_id: string } | null>(null);
  const [editandoTrilha, setEditandoTrilha] = useState(false);

  const modules = (data?.modules ?? []) as Module[];
  // #274 — achado extra: faltava aqui o mesmo `&& base === ...` que o
  // Classroom já tinha (classroom-view.tsx). Sem ele, `can_edit` vem `true`
  // do servidor mesmo na prévia — é o DONO de verdade autenticado, e ele
  // realmente pode editar a própria trilha — e os botões de editar/apagar
  // apareciam em "Ver como aluno". A prévia só é honesta sem eles.
  const podeEditar = data?.can_edit === true && base === "/educacao";
  const concluidas = new Set(data?.concluidas ?? []);
  // #274 — "Marcar como vista" continua aparecendo na prévia (mostra o que o
  // aluno vê e poderia clicar), mas o clique é recusado — nunca grava
  // progresso da Academy em nome do mentor.
  const isPreview = !!previewPersonId;

  // Todas as aulas em ordem de leitura, para achar a atual e a próxima.
  const aulas = useMemo(() => {
    const out: Lesson[] = [];
    for (const m of modules) {
      out.push(...m.lessons);
      for (const s of m.submodules ?? []) out.push(...s.lessons);
    }
    return out.filter((l) => podeEditar || l.is_published);
  }, [modules, podeEditar]);

  // Abre na primeira aula não concluída — retomar de onde parou.
  useEffect(() => {
    if (aulaId || aulas.length === 0) return;
    setAulaId((aulas.find((l) => !concluidas.has(l.id)) ?? aulas[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulas.length]);

  const aula = aulas.find((l) => l.id === aulaId) ?? null;
  const vid = youtubeId(aula?.video_url);

  const marcar = useMutation({
    mutationFn: (v: { lesson_id: string; done: boolean }) =>
      toggleFn({ data: { ...v, track_id: trackId } }),
    onSuccess: inv,
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando trilha…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Trilha não encontrada.</p>;

  // Trancada: capa e descrição, e mais nada. A RLS já não devolve as aulas —
  // esta tela existe para dizer o porquê, em vez de mostrar "nenhuma aula
  // ainda" e passar por conteúdo vazio.
  if (data.liberada === false) {
    return (
      <div className="space-y-6">
        <Link
          to={base} search={previewPersonId ? { ver: previewPersonId } : undefined}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Voltar para a Academy
        </Link>
        <div className="overflow-hidden rounded-xl ring-1 ring-black/5">
          <div className="relative h-40 w-full bg-muted">
            {data.track.cover_url && (
              <img src={data.track.cover_url} alt="" className="absolute inset-0 size-full object-cover grayscale" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Lock className="size-10 text-white/90" />
            </div>
          </div>
          <div className="bg-card p-6">
            <h1 className="text-xl font-semibold tracking-tight">{data.track.title}</h1>
            {data.track.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.track.description}</p>
            )}
            <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              Esta trilha ainda não foi liberada para você. Fale com o seu mentor se ela fizer parte
              do seu programa.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const total = aulas.length;
  const feitas = aulas.filter((l) => concluidas.has(l.id)).length;
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={base} search={previewPersonId ? { ver: previewPersonId } : undefined}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Voltar para a Academy
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.track.title}</h1>
            {data.track.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{data.track.description}</p>
            )}
          </div>
          {podeEditar && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditandoTrilha(true)}>
                <Pencil className="size-4" /> Editar trilha
              </Button>
              <Button onClick={() => setEditModulo({ parent_id: null })}>
                <Plus className="size-4" /> Módulo
              </Button>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="mt-4 max-w-md">
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>{feitas} de {total} aulas</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* #221 F1 — só quem edita vê quem concluiu; o aluno já tem a própria
          barra de progresso acima. */}
      {podeEditar && (
        <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Quem concluiu
          </h2>
          <div className="mt-3">
            <ListaDeConcluidosTrilha trackId={trackId} />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* -------- Player -------- */}
        <div className="space-y-4">
          {aula ? (
            <>
              <div className="overflow-hidden rounded-xl bg-black ring-1 ring-black/5">
                {vid ? (
                  <iframe
                    key={vid}
                    className="aspect-video w-full"
                    src={`https://www.youtube-nocookie.com/embed/${vid}`}
                    title={aula.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-sm text-white/70">
                    <Video className="size-8" />
                    {aula.video_url ? (
                      <a href={aula.video_url} target="_blank" rel="noreferrer" className="underline">
                        Abrir vídeo
                      </a>
                    ) : (
                      <span>Esta aula ainda não tem vídeo.</span>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{aula.title}</h2>
                    {aula.duration_min != null && (
                      <p className="text-xs text-muted-foreground">{aula.duration_min} min</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={concluidas.has(aula.id) ? "default" : "outline"}
                      onClick={() => bloqueadoNoPreview(isPreview, () => marcar.mutate({ lesson_id: aula.id, done: !concluidas.has(aula.id) }))}
                      disabled={marcar.isPending}
                    >
                      <Check className="size-4" />
                      {concluidas.has(aula.id) ? "Concluída" : "Marcar como vista"}
                    </Button>
                    {podeEditar && (
                      <Button variant="ghost" onClick={() => setEditAula({ id: aula.id, module_id: aula.module_id })}>
                        <Pencil className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {aula.description && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {aula.description}
                  </p>
                )}

                <div className="mt-5 border-t border-black/5 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Materiais</h3>
                    {podeEditar && (
                      <Button variant="ghost" size="sm" onClick={() => setEditMaterial({ lesson_id: aula.id })}>
                        <Plus className="size-3" /> Adicionar
                      </Button>
                    )}
                  </div>
                  {aula.materials.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">Nenhum material nesta aula.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {aula.materials.map((m) => {
                        const Icone = ICONE_MATERIAL[m.kind] ?? Paperclip;
                        return (
                          <li key={m.id} className="flex items-center gap-2">
                            <a
                              href={m.url} target="_blank" rel="noreferrer"
                              className="flex flex-1 items-center gap-2 rounded-lg border border-black/5 px-3 py-2 text-sm hover:bg-muted/40"
                            >
                              <Icone className="size-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{m.title}</span>
                              <ExternalLink className="ml-auto size-3 shrink-0 text-muted-foreground" />
                            </a>
                            {podeEditar && (
                              <Button variant="ghost" size="sm" onClick={() => setEditMaterial({ id: m.id, lesson_id: aula.id })}>
                                <Pencil className="size-3" />
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
              <Video className="mx-auto size-8 text-muted-foreground" />
              <h2 className="mt-4 text-base font-medium">Nenhuma aula ainda</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {podeEditar
                  ? "Crie um módulo e adicione a primeira aula com o link do YouTube."
                  : "Assim que houver aulas publicadas, elas aparecem aqui."}
              </p>
            </div>
          )}
        </div>

        {/* -------- Índice -------- */}
        <aside className="space-y-3">
          {modules.length === 0 && podeEditar && (
            <p className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground">
              Comece criando um módulo. Depois cada módulo pode ter submódulos e aulas.
            </p>
          )}
          {modules.map((m) => (
            <ModuloBloco
              key={m.id} m={m} aulaId={aulaId} setAulaId={setAulaId} concluidas={concluidas}
              podeEditar={podeEditar}
              onEditarModulo={(id, parent) => setEditModulo({ id, parent_id: parent })}
              onNovoSub={(pid) => setEditModulo({ parent_id: pid })}
              onNovaAula={(mid) => setEditAula({ module_id: mid })}
              onRemover={inv}
            />
          ))}
        </aside>
      </div>

      {editModulo && (
        <ModuloDialog
          trackId={trackId} inicial={editModulo} modules={modules}
          onFechar={() => setEditModulo(null)} onSalvo={() => { setEditModulo(null); inv(); }}
        />
      )}
      {editAula && (
        <AulaDialog
          trackId={trackId} inicial={editAula} aulas={aulas}
          onFechar={() => setEditAula(null)} onSalvo={() => { setEditAula(null); inv(); }}
        />
      )}
      {editMaterial && (
        <MaterialDialog
          trackId={trackId} inicial={editMaterial} aulas={aulas}
          onFechar={() => setEditMaterial(null)} onSalvo={() => { setEditMaterial(null); inv(); }}
        />
      )}
      {editandoTrilha && (
        <TrilhaDialog
          track={data.track} onFechar={() => setEditandoTrilha(false)}
          onSalvo={() => {
            setEditandoTrilha(false); inv();
            qc.invalidateQueries({ queryKey: ["tracks"] });
            // #221 F1 — mesmo motivo do Classroom: mudar o percentual mínimo
            // precisa refletir na régua sem precisar recarregar a página.
            qc.invalidateQueries({ queryKey: ["concluidos-trilha", trackId] });
          }}
        />
      )}
    </div>
  );
}

function ModuloBloco({
  m, aulaId, setAulaId, concluidas, podeEditar, onEditarModulo, onNovoSub, onNovaAula, onRemover, nivel = 0,
}: {
  m: Module; aulaId: string | null; setAulaId: (id: string) => void; concluidas: Set<string>;
  podeEditar: boolean; onEditarModulo: (id: string, parent: string | null) => void;
  onNovoSub: (pid: string) => void; onNovaAula: (mid: string) => void; onRemover: () => void; nivel?: number;
}) {
  const delModFn = useServerFn(deleteModule);
  const del = useMutation({
    mutationFn: (id: string) => delModFn({ data: { id } }),
    onSuccess: () => { onRemover(); toast.success("Módulo removido"); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return (
    <div className={`rounded-xl bg-card ring-1 ring-black/5 ${nivel > 0 ? "ml-3" : ""}`}>
      <div className="flex items-start justify-between gap-2 border-b border-black/5 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{m.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {m.lessons.length} aula{m.lessons.length === 1 ? "" : "s"}
          </p>
        </div>
        {podeEditar && (
          <div className="flex shrink-0 gap-0.5">
            <Button variant="ghost" size="sm" title="Nova aula" onClick={() => onNovaAula(m.id)}>
              <Plus className="size-3" />
            </Button>
            <Button variant="ghost" size="sm" title="Editar" onClick={() => onEditarModulo(m.id, null)}>
              <Pencil className="size-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm"><Trash2 className="size-3" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover “{m.title}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    As aulas e os materiais dentro dele também são apagados. Não dá para desfazer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => del.mutate(m.id)}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <ul className="divide-y divide-black/5">
        {m.lessons.map((l) => (
          <li key={l.id}>
            <button
              onClick={() => setAulaId(l.id)}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/40 ${
                aulaId === l.id ? "bg-primary/5 font-medium" : ""
              }`}
            >
              {concluidas.has(l.id)
                ? <CircleCheck className="size-4 shrink-0 text-emerald-600" />
                : <Video className="size-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{l.title}</span>
              {!l.is_published && <span className="shrink-0 text-[10px] uppercase text-amber-700">rascunho</span>}
              {l.duration_min != null && (
                <span className="shrink-0 text-[11px] text-muted-foreground">{l.duration_min}min</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {(m.submodules ?? []).length > 0 && (
        <div className="space-y-2 p-2">
          {(m.submodules ?? []).map((s) => (
            <ModuloBloco
              key={s.id} m={s} aulaId={aulaId} setAulaId={setAulaId} concluidas={concluidas}
              podeEditar={podeEditar} onEditarModulo={onEditarModulo} onNovoSub={onNovoSub}
              onNovaAula={onNovaAula} onRemover={onRemover} nivel={nivel + 1}
            />
          ))}
        </div>
      )}

      {podeEditar && nivel === 0 && (
        <button
          onClick={() => onNovoSub(m.id)}
          className="w-full border-t border-black/5 px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-muted/40"
        >
          + submódulo
        </button>
      )}
    </div>
  );
}

function ModuloDialog({
  trackId, inicial, modules, onFechar, onSalvo,
}: {
  trackId: string; inicial: { id?: string; parent_id?: string | null }; modules: Module[];
  onFechar: () => void; onSalvo: () => void;
}) {
  const atual = inicial.id
    ? modules.flatMap((m) => [m, ...(m.submodules ?? [])]).find((m) => m.id === inicial.id)
    : null;
  const [title, setTitle] = useState(atual?.title ?? "");
  const [description, setDescription] = useState(atual?.description ?? "");
  const saveFn = useServerFn(saveModule);
  const salvar = useMutation({
    mutationFn: () => saveFn({
      data: {
        id: inicial.id, track_id: trackId, parent_id: inicial.parent_id ?? null,
        title: title.trim(), description: description.trim() || null,
      },
    }),
    onSuccess: () => { toast.success(inicial.id ? "Módulo atualizado" : "Módulo criado"); onSalvo(); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const ehSub = !!inicial.parent_id;
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{inicial.id ? "Editar" : "Novo"} {ehSub ? "submódulo" : "módulo"}</DialogTitle>
        </DialogHeader>
        <form id="form-modulo" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" form="form-modulo" disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AulaDialog({
  trackId, inicial, aulas, onFechar, onSalvo,
}: {
  trackId: string; inicial: { id?: string; module_id: string }; aulas: Lesson[];
  onFechar: () => void; onSalvo: () => void;
}) {
  const atual = aulas.find((l) => l.id === inicial.id);
  const [title, setTitle] = useState(atual?.title ?? "");
  const [description, setDescription] = useState(atual?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(atual?.video_url ?? "");
  const [duracao, setDuracao] = useState(atual?.duration_min != null ? String(atual.duration_min) : "");
  const [publicada, setPublicada] = useState(atual?.is_published ?? true);

  const saveFn = useServerFn(saveLesson);
  const delFn = useServerFn(deleteLesson);
  const salvar = useMutation({
    mutationFn: () => saveFn({
      data: {
        id: inicial.id, track_id: trackId, module_id: inicial.module_id,
        title: title.trim(), description: description.trim() || null,
        video_url: videoUrl.trim() || null,
        duration_min: duracao ? Number(duracao) : null,
        is_published: publicada,
      },
    }),
    onSuccess: () => { toast.success(inicial.id ? "Aula atualizada" : "Aula criada"); onSalvo(); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });
  const remover = useMutation({
    mutationFn: () => delFn({ data: { id: inicial.id! } }),
    onSuccess: () => { toast.success("Aula removida"); onSalvo(); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const vid = youtubeId(videoUrl);
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inicial.id ? "Editar aula" : "Nova aula"}</DialogTitle>
        </DialogHeader>
        <form id="form-aula" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Link do vídeo (YouTube)</Label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} maxLength={600} placeholder="https://www.youtube.com/watch?v=..." />
            <p className="text-[11px] text-muted-foreground">
              {videoUrl.trim() === ""
                ? "Pode deixar vazio e preencher depois."
                : vid
                  ? "✓ Link reconhecido — o vídeo vai tocar dentro da plataforma."
                  : "Não reconheci como YouTube. A aula vai mostrar um botão para abrir o link."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Duração (minutos)</Label>
              <Input type="number" min={0} max={1000} value={duracao} onChange={(e) => setDuracao(e.target.value)} />
            </div>
            <div className="flex items-end justify-between gap-3 pb-1">
              <div>
                <p className="text-sm font-medium">Publicada</p>
                <p className="text-[11px] text-muted-foreground">Desligada, só a equipe vê.</p>
              </div>
              <Switch checked={publicada} onCheckedChange={setPublicada} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={4000} />
          </div>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {inicial.id ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive"><Trash2 className="size-4" /> Remover</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover esta aula?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os materiais dela também são apagados. Não dá para desfazer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remover.mutate()}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" form="form-aula" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaterialDialog({
  trackId, inicial, aulas, onFechar, onSalvo,
}: {
  trackId: string; inicial: { id?: string; lesson_id: string }; aulas: Lesson[];
  onFechar: () => void; onSalvo: () => void;
}) {
  const atual = aulas.flatMap((l) => l.materials).find((m) => m.id === inicial.id);
  const [title, setTitle] = useState(atual?.title ?? "");
  const [url, setUrl] = useState(atual?.url ?? "");
  const [kind, setKind] = useState<string>(atual?.kind ?? "link");

  const saveFn = useServerFn(saveMaterial);
  const delFn = useServerFn(deleteMaterial);
  const salvar = useMutation({
    mutationFn: () => saveFn({
      data: {
        id: inicial.id, track_id: trackId, lesson_id: inicial.lesson_id,
        title: title.trim(), url: url.trim(), kind: kind as (typeof TIPOS_MATERIAL)[number],
      },
    }),
    onSuccess: () => { toast.success("Material salvo"); onSalvo(); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });
  const remover = useMutation({
    mutationFn: () => delFn({ data: { id: inicial.id! } }),
    onSuccess: () => { toast.success("Material removido"); onSalvo(); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{inicial.id ? "Editar material" : "Novo material"}</DialogTitle>
        </DialogHeader>
        <form id="form-material" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="Ex.: Apostila da aula 1" />
          </div>
          <div className="space-y-2">
            <Label>Link</Label>
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required maxLength={1000} placeholder="https://drive.google.com/..." />
            <p className="text-[11px] text-muted-foreground">
              Cole o link do Google Drive, Notion, ou de onde o arquivo estiver. Confira se o
              compartilhamento está aberto para quem vai assistir.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-2">
              {TIPOS_MATERIAL.map((t) => (
                <button
                  key={t} type="button" onClick={() => setKind(t)}
                  className={`rounded-full px-3 py-1 text-xs capitalize transition ${
                    kind === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {inicial.id ? (
            <Button variant="ghost" className="text-destructive" onClick={() => remover.mutate()}>
              <Trash2 className="size-4" /> Remover
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" form="form-material" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TrilhaDialog({
  track, onFechar, onSalvo,
}: {
  track: {
    id: string; title: string; description: string | null; cover_url: string | null;
    audience: string; is_published: boolean; percentual_minimo?: number | null;
  };
  onFechar: () => void; onSalvo: () => void;
}) {
  const [title, setTitle] = useState(track.title);
  const [description, setDescription] = useState(track.description ?? "");
  const [coverUrl, setCoverUrl] = useState(track.cover_url ?? "");
  const [audience, setAudience] = useState(track.audience);
  // #221 F1 — texto, não número: mesmo motivo do TreinamentoDialog (Classroom).
  const [percentualMinimo, setPercentualMinimo] = useState(String(track.percentual_minimo ?? 100));
  const [publicada, setPublicada] = useState(track.is_published);

  // O bucket é privado: `coverUrl` guarda o IDENTIFICADOR (o que salva).
  // `coverPreview` guarda a versão ASSINADA de um upload feito NESTA sessão,
  // só para o <img> ter o que mostrar antes de salvar — nunca vai para o
  // servidor. `null` cai no fallback (o que `getTrack` já devolveu assinado,
  // ao editar uma capa que já existia).
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  // A capa escolhida no seletor passa pelo recorte ANTES de virar upload.
  const [paraRecortar, setParaRecortar] = useState<File | null>(null);
  const previaFn = useServerFn(assinarMeuEnvio);

  async function enviarCapa(f: File) {
    if (f.size > 3 * 1024 * 1024) return toast.error("Imagem muito grande (máximo 3 MB).");
    setEnviandoCapa(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const ext = f.name.split(".").pop() ?? "jpg";
      const caminho = `${sessao.user?.id}/trilha-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("biblioteca").upload(caminho, f);
      if (error) throw new Error(erroDeUpload(error, "biblioteca"));
      const { data: pub } = supabase.storage.from("biblioteca").getPublicUrl(caminho);
      // Pede ao servidor a versão assinada deste MESMO arquivo que acabei de
      // enviar, só para o preview — o bucket privado não deixa o navegador
      // assinar sozinho. Se falhar, ainda salva certo; só o preview imediato
      // fica sem imagem até recarregar.
      try {
        setCoverPreview((await previaFn({ data: { url: pub.publicUrl } })).url);
      } catch { /* sem preview agora — não impede salvar */ }
      setCoverUrl(pub.publicUrl);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviandoCapa(false);
    }
  }

  const qc = useQueryClient();
  const destinosFn = useServerFn(getTrackDestinos);
  const setDestinosFn = useServerFn(setTrackDestinos);
  const { data: destinos } = useQuery({
    queryKey: ["track-destinos", track.id],
    queryFn: () => destinosFn({ data: { track_id: track.id } }),
  });
  // `null` enquanto não carregou: gravar antes disso mandaria lista vazia e
  // abriria a trilha para todo mundo sem ele ter mexido em nada.
  const [grupos, setGrupos] = useState<string[] | null>(null);
  const [pessoas, setPessoas] = useState<string[] | null>(null);
  useEffect(() => {
    if (!destinos) return;
    setGrupos((v) => v ?? destinos.group_ids);
    setPessoas((v) => v ?? destinos.person_ids);
  }, [destinos]);

  const saveFn = useServerFn(updateTrack);
  const delFn = useServerFn(deleteTrack);
  const navigate = useNavigate();
  const salvar = useMutation({
    mutationFn: async () => {
      await saveFn({
        data: {
          id: track.id, title: title.trim(), description: description.trim() || null,
          cover_url: coverUrl.trim() || null,
          audience: audience as "equipe" | "alunos" | "ambos", is_published: publicada,
          percentual_minimo: Math.min(100, Math.max(1, Number(percentualMinimo) || 100)),
        },
      });
      if (grupos && pessoas) {
        await setDestinosFn({ data: { track_id: track.id, group_ids: grupos, person_ids: pessoas } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["track-destinos", track.id] });
      toast.success("Trilha atualizada");
      onSalvo();
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });
  const remover = useMutation({
    mutationFn: () => delFn({ data: { id: track.id } }),
    // #275 — mesmo padrão do TreinamentoDialog: navigate troca de rota na
    // hora, em vez do reload duro deixar o diálogo visível até recarregar.
    onSuccess: () => { toast.success("Trilha removida"); navigate({ to: "/educacao" }); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar trilha</DialogTitle></DialogHeader>
          <form id="form-trilha-edit" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
            </div>
            <div className="space-y-2">
              <Label>Imagem de capa</Label>
              {coverUrl ? (
                <div className="relative overflow-hidden rounded-lg">
                  <img src={coverPreview ?? coverUrl} alt="" className="h-28 w-full object-cover" />
                  <button type="button"
                    onClick={() => { setCoverUrl(""); setCoverPreview(null); }}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                    title="Remover capa">
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                  <ImageIcon className="size-4" />
                  {enviandoCapa ? "Enviando…" : "JPG ou PNG (até 3 MB)"}
                  <input type="file" accept="image/jpeg,image/png" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setParaRecortar(f);
                      e.target.value = "";
                    }} />
                </label>
              )}
              <p className="text-[11px] text-muted-foreground">Opcional. Sem capa, a trilha ganha uma cor própria.</p>
            </div>
            <div className="space-y-2">
              <Label>Quem vai assistir</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {PUBLICOS.map((p) => (
                  <button
                    key={p.valor} type="button" onClick={() => setAudience(p.valor)}
                    className={`rounded-lg border p-3 text-left transition ${
                      audience === p.valor ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-black/10 hover:bg-muted/40"
                    }`}
                  >
                    <p className="text-sm font-medium">{p.titulo}</p>
                    <p className="text-[11px] text-muted-foreground">{p.ajuda}</p>
                  </button>
                ))}
              </div>
            </div>
            {/* Trilha só da equipe não tem aluno para trancar — a caixa apareceria
                pedindo uma escolha que não muda nada. */}
            {audience !== "equipe" && (
              <QuemAcessa
                grupos={grupos ?? []} pessoas={pessoas ?? []}
                setGrupos={setGrupos} setPessoas={setPessoas}
              />
            )}
            <div className="space-y-2">
              <Label>Percentual mínimo para concluir</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={100} className="w-24"
                  value={percentualMinimo}
                  onChange={(e) => setPercentualMinimo(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">% das aulas assistidas</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Conta as aulas publicadas que a pessoa já marcou como vista.
                <strong> Padrão 100%</strong> — mudar aqui vale a partir de agora, não reescreve
                quem já tinha concluído pela régua anterior.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-black/5 p-3">
              <div>
                <p className="text-sm font-medium">Publicada</p>
                <p className="text-[11px] text-muted-foreground">
                  Desligada, a trilha fica como rascunho e ninguém de fora da equipe enxerga.
                </p>
              </div>
              <Switch checked={publicada} onCheckedChange={setPublicada} />
            </div>
          </form>
          <DialogFooter className="gap-2 sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive"><Trash2 className="size-4" /> Remover trilha</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover “{track.title}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os módulos, aulas e materiais dela vão junto, e o progresso de quem assistiu
                    também. Não dá para desfazer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remover.mutate()}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
              <Button type="submit" form="form-trilha-edit" disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RecortarImagem
        arquivo={paraRecortar}
        aspecto={16 / 9}
        onCancelar={() => setParaRecortar(null)}
        onConcluir={(recortado) => { setParaRecortar(null); enviarCapa(recortado); }}
      />
    </>
  );
}
