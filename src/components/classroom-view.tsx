/**
 * Um treinamento presencial: a ficha da aula à esquerda, o índice de módulos à
 * direita — o esqueleto da TrackView da Academy, sem player.
 *
 * O lugar do vídeo é ocupado pelo que uma aula presencial tem de verdade:
 * quando, onde, o que o aluno precisa saber antes, e os materiais. As
 * anotações do professor ficam num bloco à parte, marcado — descrição o aluno
 * lê, anotação é roteiro de quem dá a aula.
 *
 * Esta tela é do MASTER (etapa 2 do plano em docs/analise-classroom.md). A
 * versão do aluno é a etapa 3; check-in e presença, as etapas 4 e 5.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getTreinamento, updateTreinamento, deleteTreinamento, setGruposDoTreinamento,
  saveModulo, deleteModulo, saveAula, deleteAula,
  saveMaterialAula, deleteMaterialAula, TIPOS_MATERIAL_TREINAMENTO,
} from "@/lib/classroom.functions";
import { meusGrupos } from "@/lib/comunidade.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, CalendarClock, ExternalLink, FileText, FolderKanban, Lock, MapPin, NotebookPen,
  Paperclip, Pencil, Plus, Presentation, QrCode, Trash2, Upload, Video, X,
} from "lucide-react";
import { CheckinDialog } from "@/components/checkin-professor";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type MaterialT = { id: string; titulo: string; url: string; kind: string };
type AulaT = {
  id: string; modulo_id: string; titulo: string; descricao: string | null; anotacoes: string | null;
  comeca_em: string | null; termina_em: string | null; local: string | null; materiais: MaterialT[];
};
type ModuloT = { id: string; titulo: string; aulas: AulaT[] };

const ICONE_MATERIAL: Record<string, typeof FileText> = {
  pdf: FileText, slide: Presentation, roteiro: NotebookPen, planilha: FileText,
  video: Video, audio: Video, link: ExternalLink, outro: Paperclip,
};

/** ISO → valor de um `datetime-local`, no fuso de quem edita. */
function paraInputLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const HORA = { hour: "2-digit", minute: "2-digit" } as const;

/** "quarta, 05 de agosto · 14:00–17:00" — ou as duas datas, se virar o dia. */
function formatarPeriodo(comeca: string | null, termina: string | null) {
  if (!comeca) return null;
  const ini = new Date(comeca);
  const dia = ini.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const hIni = ini.toLocaleTimeString("pt-BR", HORA);
  if (!termina) return `${dia} · ${hIni}`;
  const fim = new Date(termina);
  const mesmoDia = ini.toDateString() === fim.toDateString();
  return mesmoDia
    ? `${dia} · ${hIni}–${fim.toLocaleTimeString("pt-BR", HORA)}`
    : `${dia} ${hIni} → ${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ${fim.toLocaleTimeString("pt-BR", HORA)}`;
}

export type ClassroomViewBase = "/classroom" | "/aluno/classroom";

export function TreinamentoView({ treinamentoId, base }: { treinamentoId: string; base: ClassroomViewBase }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getTreinamento);
  const { data, isLoading } = useQuery({
    queryKey: ["treinamento", treinamentoId],
    queryFn: () => getFn({ data: { id: treinamentoId } }),
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["treinamento", treinamentoId] });

  const [aulaId, setAulaId] = useState<string | null>(null);
  const [editModulo, setEditModulo] = useState<{ id?: string } | null>(null);
  const [editAula, setEditAula] = useState<{ id?: string; modulo_id: string } | null>(null);
  const [editMaterial, setEditMaterial] = useState<{ id?: string; aula_id: string } | null>(null);
  const [editandoTreinamento, setEditandoTreinamento] = useState(false);
  const [checkinDe, setCheckinDe] = useState<string | null>(null);

  const modules = useMemo(
    () =>
      ((data?.modules ?? []) as unknown as Array<Record<string, unknown>>).map((m) => ({
        id: m.id as string,
        titulo: m.titulo as string,
        aulas: (m.aulas ?? []) as AulaT[],
      })) as ModuloT[],
    [data?.modules],
  );
  // No painel do aluno NINGUÉM edita — nem o dono em "Ver como aluno". A
  // prévia só é honesta se mostrar o que o aluno vê: sem botões e sem as
  // anotações do professor (que o servidor nem manda para quem não é dono,
  // mas aqui o dono É o dono — o corte é da tela).
  const podeEditar = data?.can_edit === true && base === "/classroom";

  const aulas = useMemo(() => modules.flatMap((m) => m.aulas), [modules]);

  // Abre na primeira aula ainda por vir; se o treinamento já acabou, na última.
  useEffect(() => {
    if (aulaId || aulas.length === 0) return;
    const agora = Date.now();
    const proxima = aulas.find((a) => !a.comeca_em || new Date(a.comeca_em).getTime() >= agora);
    setAulaId((proxima ?? aulas[aulas.length - 1]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulas.length]);

  const aula = aulas.find((a) => a.id === aulaId) ?? null;

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando treinamento…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Treinamento não encontrado.</p>;

  const t = data.treinamento;
  const grupos = data.grupos;

  return (
    <div className="space-y-6">
      <div>
        <Link to={base} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Voltar para o Classroom
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{t.titulo}</h1>
              {!t.publicado && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                  <Lock className="size-3" /> rascunho
                </span>
              )}
            </div>
            {t.descricao && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.descricao}</p>
            )}
            {/* Quem participa não precisa saber para quais grupos foi
                publicado — e a RLS de `groups` nem entrega o nome ao aluno. */}
            {podeEditar && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <FolderKanban className="size-3.5 text-muted-foreground" />
                {grupos.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Nenhum grupo com acesso ainda — escolha em “Editar treinamento”.
                  </span>
                ) : (
                  grupos.map((g) => (
                    <span key={g.id} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {g.name}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>
          {podeEditar && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditandoTreinamento(true)}>
                <Pencil className="size-4" /> Editar treinamento
              </Button>
              <Button onClick={() => setEditModulo({})}>
                <Plus className="size-4" /> Módulo
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* -------- Ficha da aula -------- */}
        <div className="space-y-4">
          {aula ? (
            <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{aula.titulo}</h2>
                  <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {aula.comeca_em ? (
                      <p className="flex items-center gap-1.5">
                        <CalendarClock className="size-4 shrink-0" />
                        {formatarPeriodo(aula.comeca_em, aula.termina_em)}
                      </p>
                    ) : podeEditar ? (
                      <p className="flex items-center gap-1.5 text-amber-700">
                        <CalendarClock className="size-4 shrink-0" />
                        Sem data marcada — o check-in vai precisar dela.
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5">
                        <CalendarClock className="size-4 shrink-0" /> Data a definir.
                      </p>
                    )}
                    {aula.local && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="size-4 shrink-0" /> {aula.local}
                      </p>
                    )}
                  </div>
                </div>
                {podeEditar && (
                  <div className="flex shrink-0 gap-2">
                    <Button onClick={() => setCheckinDe(aula.id)}>
                      <QrCode className="size-4" /> Check-in
                    </Button>
                    <Button variant="ghost" onClick={() => setEditAula({ id: aula.id, modulo_id: aula.modulo_id })}>
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              {aula.descricao && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {aula.descricao}
                </p>
              )}

              {podeEditar && aula.anotacoes && (
                <div className="mt-4 rounded-lg border border-amber-200/70 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                    <NotebookPen className="size-3.5" /> Anotações do professor — o aluno não vê
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{aula.anotacoes}</p>
                </div>
              )}

              <div className="mt-5 border-t border-black/5 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Materiais</h3>
                  {podeEditar && (
                    <Button variant="ghost" size="sm" onClick={() => setEditMaterial({ aula_id: aula.id })}>
                      <Plus className="size-3" /> Adicionar
                    </Button>
                  )}
                </div>
                {aula.materiais.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nenhum material nesta aula.{podeEditar && " Slides, roteiros e apostilas entram aqui."}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {aula.materiais.map((m) => {
                      const Icone = ICONE_MATERIAL[m.kind] ?? Paperclip;
                      return (
                        <li key={m.id} className="flex items-center gap-2">
                          <a
                            href={m.url} target="_blank" rel="noreferrer"
                            className="flex flex-1 items-center gap-2 rounded-lg border border-black/5 px-3 py-2 text-sm hover:bg-muted/40"
                          >
                            <Icone className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{m.titulo}</span>
                            <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                              {m.kind}
                            </span>
                            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                          </a>
                          {podeEditar && (
                            <Button variant="ghost" size="sm" onClick={() => setEditMaterial({ id: m.id, aula_id: aula.id })}>
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
          ) : (
            <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
              <Presentation className="mx-auto size-8 text-muted-foreground" />
              <h2 className="mt-4 text-base font-medium">Nenhuma aula ainda</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {podeEditar
                  ? "Crie um módulo e adicione a primeira aula, com data, horário e local do encontro."
                  : "Assim que houver aulas, elas aparecem aqui."}
              </p>
            </div>
          )}
        </div>

        {/* -------- Índice -------- */}
        <aside className="space-y-3">
          {modules.length === 0 && podeEditar && (
            <p className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground">
              Comece criando um módulo — “Dia 1”, “Fundamentos”, como você organizar o treinamento.
            </p>
          )}
          {modules.map((m) => (
            <ModuloBloco
              key={m.id} m={m} aulaId={aulaId} setAulaId={setAulaId} podeEditar={podeEditar}
              onEditarModulo={(id) => setEditModulo({ id })}
              onNovaAula={(mid) => setEditAula({ modulo_id: mid })}
              onRemover={inv}
            />
          ))}
        </aside>
      </div>

      {editModulo && (
        <ModuloDialog
          treinamentoId={treinamentoId} inicial={editModulo} modules={modules}
          onFechar={() => setEditModulo(null)} onSalvo={() => { setEditModulo(null); inv(); }}
        />
      )}
      {editAula && (
        <AulaDialog
          inicial={editAula} aulas={aulas}
          onFechar={() => setEditAula(null)} onSalvo={() => { setEditAula(null); inv(); }}
        />
      )}
      {editMaterial && (
        <MaterialDialog
          inicial={editMaterial} aulas={aulas}
          onFechar={() => setEditMaterial(null)} onSalvo={() => { setEditMaterial(null); inv(); }}
        />
      )}
      {checkinDe && <CheckinDialog aulaId={checkinDe} onFechar={() => setCheckinDe(null)} />}
      {editandoTreinamento && (
        <TreinamentoDialog
          treinamento={t} gruposAtuais={grupos.map((g) => g.id)}
          onFechar={() => setEditandoTreinamento(false)}
          onSalvo={() => {
            setEditandoTreinamento(false); inv();
            qc.invalidateQueries({ queryKey: ["treinamentos"] });
          }}
        />
      )}
    </div>
  );
}

function ModuloBloco({
  m, aulaId, setAulaId, podeEditar, onEditarModulo, onNovaAula, onRemover,
}: {
  m: ModuloT; aulaId: string | null; setAulaId: (id: string) => void; podeEditar: boolean;
  onEditarModulo: (id: string) => void; onNovaAula: (mid: string) => void; onRemover: () => void;
}) {
  const delFn = useServerFn(deleteModulo);
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { onRemover(); toast.success("Módulo removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl bg-card ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-2 border-b border-black/5 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{m.titulo}</p>
          <p className="text-[11px] text-muted-foreground">
            {m.aulas.length} aula{m.aulas.length === 1 ? "" : "s"}
          </p>
        </div>
        {podeEditar && (
          <div className="flex shrink-0 gap-0.5">
            <Button variant="ghost" size="sm" title="Nova aula" onClick={() => onNovaAula(m.id)}>
              <Plus className="size-3" />
            </Button>
            <Button variant="ghost" size="sm" title="Editar" onClick={() => onEditarModulo(m.id)}>
              <Pencil className="size-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm"><Trash2 className="size-3" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover “{m.titulo}”?</AlertDialogTitle>
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
        {m.aulas.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => setAulaId(a.id)}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/40 ${
                aulaId === a.id ? "bg-primary/5 font-medium" : ""
              }`}
            >
              <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{a.titulo}</span>
              {a.comeca_em && (
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(a.comeca_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModuloDialog({
  treinamentoId, inicial, modules, onFechar, onSalvo,
}: {
  treinamentoId: string; inicial: { id?: string }; modules: ModuloT[];
  onFechar: () => void; onSalvo: () => void;
}) {
  const atual = inicial.id ? modules.find((m) => m.id === inicial.id) : null;
  const [titulo, setTitulo] = useState(atual?.titulo ?? "");
  const saveFn = useServerFn(saveModulo);
  const salvar = useMutation({
    mutationFn: () => saveFn({
      data: { id: inicial.id, treinamento_id: treinamentoId, titulo: titulo.trim() },
    }),
    onSuccess: () => { toast.success(inicial.id ? "Módulo atualizado" : "Módulo criado"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{inicial.id ? "Editar módulo" : "Novo módulo"}</DialogTitle>
        </DialogHeader>
        <form id="form-modulo-t" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200} placeholder="Ex.: Dia 1 — Fundamentos" />
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" form="form-modulo-t" disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AulaDialog({
  inicial, aulas, onFechar, onSalvo,
}: {
  inicial: { id?: string; modulo_id: string }; aulas: AulaT[];
  onFechar: () => void; onSalvo: () => void;
}) {
  const atual = aulas.find((a) => a.id === inicial.id);
  const [titulo, setTitulo] = useState(atual?.titulo ?? "");
  const [descricao, setDescricao] = useState(atual?.descricao ?? "");
  const [anotacoes, setAnotacoes] = useState(atual?.anotacoes ?? "");
  const [comecaEm, setComecaEm] = useState(paraInputLocal(atual?.comeca_em));
  const [terminaEm, setTerminaEm] = useState(paraInputLocal(atual?.termina_em));
  const [local, setLocal] = useState(atual?.local ?? "");

  const saveFn = useServerFn(saveAula);
  const delFn = useServerFn(deleteAula);
  const salvar = useMutation({
    mutationFn: () => saveFn({
      data: {
        id: inicial.id, modulo_id: inicial.modulo_id,
        titulo: titulo.trim(), descricao: descricao.trim() || null,
        anotacoes: anotacoes.trim() || null,
        // O `datetime-local` devolve hora SEM fuso; `new Date` lê como horário
        // local e `toISOString` manda em UTC com o fuso embutido — sem isso o
        // servidor leria 14:00 como horário de Londres. Ver novo-evento.tsx.
        comeca_em: comecaEm ? new Date(comecaEm).toISOString() : null,
        termina_em: terminaEm ? new Date(terminaEm).toISOString() : null,
        local: local.trim() || null,
      },
    }),
    onSuccess: () => { toast.success(inicial.id ? "Aula atualizada" : "Aula criada"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remover = useMutation({
    mutationFn: () => delFn({ data: { id: inicial.id! } }),
    onSuccess: () => { toast.success("Aula removida"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fimInvalido = !!terminaEm && !!comecaEm && new Date(terminaEm) <= new Date(comecaEm);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inicial.id ? "Editar aula" : "Nova aula"}</DialogTitle>
        </DialogHeader>
        <form id="form-aula-t" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Começa em</Label>
              <Input type="datetime-local" value={comecaEm} onChange={(e) => setComecaEm(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Termina em</Label>
              <Input type="datetime-local" value={terminaEm} onChange={(e) => setTerminaEm(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {fimInvalido
              ? "O fim precisa ser depois do início."
              : "O horário vira a janela do check-in e a régua do atraso na lista de presença."}
          </p>
          <div className="space-y-2">
            <Label>Local</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} maxLength={300} placeholder="Ex.: Sala 3, Hotel Mercure — Av. Paulista, 100" />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={4000} placeholder="O que o aluno precisa saber antes do encontro." />
          </div>
          <div className="space-y-2">
            <Label>Anotações do professor</Label>
            <Textarea value={anotacoes} onChange={(e) => setAnotacoes(e.target.value)} rows={3} maxLength={8000} placeholder="Roteiro, lembretes, o que só você precisa ver." />
            <p className="text-[11px] text-muted-foreground">O aluno não vê este campo.</p>
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
            <Button type="submit" form="form-aula-t" disabled={salvar.isPending || fimInvalido}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaterialDialog({
  inicial, aulas, onFechar, onSalvo,
}: {
  inicial: { id?: string; aula_id: string }; aulas: AulaT[];
  onFechar: () => void; onSalvo: () => void;
}) {
  const atual = aulas.flatMap((a) => a.materiais).find((m) => m.id === inicial.id);
  const [titulo, setTitulo] = useState(atual?.titulo ?? "");
  const [url, setUrl] = useState(atual?.url ?? "");
  const [kind, setKind] = useState<string>(atual?.kind ?? "link");
  // "link" ou "arquivo" — mesma dupla da biblioteca: slides e apostilas sobem
  // direto, sem obrigar o desvio pelo Drive.
  const [origem, setOrigem] = useState<"link" | "arquivo">("link");
  const [enviando, setEnviando] = useState(false);

  async function enviar(f: File) {
    if (f.size > 25 * 1024 * 1024) return toast.error("Arquivo muito grande (máximo 25 MB).");
    setEnviando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const ext = f.name.split(".").pop() ?? "bin";
      const caminho = `${sessao.user?.id}/${crypto.randomUUID()}.${ext}`;
      // O balde é o mesmo da biblioteca: leitura pública com nome aleatório, e
      // cada um escreve só na própria pasta. Um balde novo não traria regra nova.
      const { error } = await supabase.storage.from("biblioteca").upload(caminho, f);
      if (error) throw new Error(error.message);
      const { data: pub } = supabase.storage.from("biblioteca").getPublicUrl(caminho);
      setUrl(pub.publicUrl);
      if (!titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const saveFn = useServerFn(saveMaterialAula);
  const delFn = useServerFn(deleteMaterialAula);
  const salvar = useMutation({
    mutationFn: () => saveFn({
      data: {
        id: inicial.id, aula_id: inicial.aula_id,
        titulo: titulo.trim(), url: url.trim(),
        kind: kind as (typeof TIPOS_MATERIAL_TREINAMENTO)[number],
      },
    }),
    onSuccess: () => { toast.success("Material salvo"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remover = useMutation({
    mutationFn: () => delFn({ data: { id: inicial.id! } }),
    onSuccess: () => { toast.success("Material removido"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{inicial.id ? "Editar material" : "Novo material"}</DialogTitle>
        </DialogHeader>
        <form id="form-material-t" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200} placeholder="Ex.: Slides do dia 1" />
          </div>
          <div className="space-y-2">
            <Label>Conteúdo</Label>
            <div className="inline-flex rounded-lg bg-muted p-1">
              {(["link", "arquivo"] as const).map((o) => (
                <button
                  key={o} type="button" onClick={() => setOrigem(o)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium",
                    origem === o ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {o === "link" ? "Colar link" : "Enviar arquivo"}
                </button>
              ))}
            </div>
            {origem === "link" ? (
              <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required maxLength={1000} placeholder="https://drive.google.com/..." />
            ) : url ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-2.5 text-sm">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">Arquivo enviado</span>
                <button type="button" onClick={() => setUrl("")} title="Remover">
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                <Upload className="size-4" />
                {enviando ? "Enviando…" : "Escolher arquivo (até 25 MB)"}
                <input type="file" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); }} />
              </label>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-2">
              {TIPOS_MATERIAL_TREINAMENTO.map((t) => (
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
            <Button type="submit" form="form-material-t" disabled={salvar.isPending || enviando || !url.trim()}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TreinamentoDialog({
  treinamento, gruposAtuais, onFechar, onSalvo,
}: {
  treinamento: { id: string; titulo: string; descricao: string | null; capa_url: string | null; publicado: boolean };
  gruposAtuais: string[]; onFechar: () => void; onSalvo: () => void;
}) {
  const [titulo, setTitulo] = useState(treinamento.titulo);
  const [descricao, setDescricao] = useState(treinamento.descricao ?? "");
  const [capaUrl, setCapaUrl] = useState(treinamento.capa_url ?? "");
  const [publicado, setPublicado] = useState(treinamento.publicado);
  const [grupos, setGrupos] = useState<string[]>(gruposAtuais);

  const gruposFn = useServerFn(meusGrupos);
  const { data: dg } = useQuery({ queryKey: ["grupos"], queryFn: () => gruposFn() });

  const saveFn = useServerFn(updateTreinamento);
  const setGruposFn = useServerFn(setGruposDoTreinamento);
  const delFn = useServerFn(deleteTreinamento);

  const salvar = useMutation({
    mutationFn: async () => {
      await saveFn({
        data: {
          id: treinamento.id, titulo: titulo.trim(), descricao: descricao.trim() || null,
          capa_url: capaUrl.trim() || null, publicado,
        },
      });
      await setGruposFn({ data: { treinamento_id: treinamento.id, group_ids: grupos } });
    },
    onSuccess: () => { toast.success("Treinamento atualizado"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remover = useMutation({
    mutationFn: () => delFn({ data: { id: treinamento.id } }),
    onSuccess: () => { toast.success("Treinamento removido"); window.location.href = "/classroom"; },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternar = (id: string) =>
    setGrupos((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar treinamento</DialogTitle></DialogHeader>
        <form id="form-trein-edit" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={2} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={2000} />
          </div>
          <div className="space-y-2">
            <Label>Imagem de capa (link)</Label>
            <Input value={capaUrl} onChange={(e) => setCapaUrl(e.target.value)} maxLength={600} placeholder="https://..." />
            <p className="text-[11px] text-muted-foreground">Opcional. Sem capa, o treinamento ganha uma cor própria.</p>
          </div>
          <div className="space-y-2">
            <Label>Grupos com acesso</Label>
            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-black/5 p-3">
              {(dg?.grupos ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum grupo na conta ainda.</p>
              ) : (
                (dg?.grupos ?? []).map((g) => (
                  <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={grupos.includes(g.id)} onCheckedChange={() => alternar(g.id)} />
                    {g.name}
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-black/5 p-3">
            <div>
              <p className="text-sm font-medium">Publicado</p>
              <p className="text-[11px] text-muted-foreground">
                {publicado && grupos.length === 0
                  ? "⚠ Publicado, mas sem grupo nenhum — nenhum aluno vai ver."
                  : "Desligado, fica como rascunho e só você enxerga."}
              </p>
            </div>
            <Switch checked={publicado} onCheckedChange={setPublicado} />
          </div>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-destructive"><Trash2 className="size-4" /> Remover treinamento</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover “{treinamento.titulo}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os módulos, aulas e materiais dele vão junto. Não dá para desfazer.
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
            <Button type="submit" form="form-trein-edit" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
