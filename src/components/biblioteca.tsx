/**
 * A biblioteca da Academy: pastas e material solto.
 *
 * O mesmo componente serve o dono e o aluno — `podeEditar` decide se aparecem
 * os botões. Quem barra de verdade é a RLS: se um dia a prop vier errada, o
 * banco recusa a escrita do mesmo jeito.
 *
 * O cadeado segue a regra da migração `20260730220000`: a pasta manda. Material
 * dentro de pasta trancada fica trancado mesmo sem destino próprio — e é a RLS
 * que decide isso, não esta tela. Aqui só se desenha o que o servidor mandou.
 *
 * Dentro da pasta os materiais saem agrupados por formato (PDFs juntos,
 * planilhas juntas, imagens juntas), que foi o pedido dele.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarBiblioteca, salvarMaterial, excluirMaterial,
  salvarPasta, excluirPasta, moverPasta,
  getDestinosBiblioteca, setDestinosBiblioteca,
  TIPOS, ROTULO_TIPO, ORDEM_TIPOS,
} from "@/lib/biblioteca.functions";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuemAcessa } from "@/components/quem-acessa";
import {
  FileText, FileSpreadsheet, Video, Music, Link as LinkIcon, Paperclip, Plus, Trash2, Search,
  Upload, Image as ImageIcon, X, Folder, FolderOpen, Lock, Pencil, ChevronUp, ChevronDown,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ICONE = {
  pdf: FileText, planilha: FileSpreadsheet, imagem: ImageIcon, video: Video,
  audio: Music, link: LinkIcon, outro: Paperclip,
} as const;

type Material = {
  id: string; titulo: string; descricao: string | null; url: string; kind: string;
  categoria: string | null; capa_url: string | null; pasta_id: string | null;
  liberado: boolean; destinos_count: number;
};
type Pasta = {
  id: string; titulo: string; descricao: string | null; capa_url: string | null;
  liberada: boolean; destinos_count: number; materiais_count: number;
};

const VAZIO = {
  id: undefined as string | undefined,
  titulo: "", descricao: "", url: "", kind: "link", categoria: "", capa_url: "",
  pasta_id: null as string | null,
};

export function Biblioteca({
  podeEditar = false, ver = null, novoMaterial, onNovoMaterial, novaPasta, onNovaPasta,
}: {
  podeEditar?: boolean;
  /** Prévia "ver como aluno": o cadeado passa a valer o daquela pessoa. */
  ver?: string | null;
  /** Abertura controlada de fora — é o menu "Criar" do cabeçalho que manda. */
  novoMaterial?: boolean;
  onNovoMaterial?: (v: boolean) => void;
  novaPasta?: boolean;
  onNovaPasta?: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const listaFn = useServerFn(listarBiblioteca);
  const salvarFn = useServerFn(salvarMaterial);
  const excluirFn = useServerFn(excluirMaterial);
  const salvarPastaFn = useServerFn(salvarPasta);
  const excluirPastaFn = useServerFn(excluirPasta);
  const moverPastaFn = useServerFn(moverPasta);

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [formPasta, setFormPasta] = useState({
    id: undefined as string | undefined, titulo: "", descricao: "", capa_url: "",
  });
  // "link" ou "arquivo". Era o que faltava: escolher o tipo "pdf" não adiantava
  // nada, porque o formulário só aceitava colar URL.
  const [origem, setOrigem] = useState<"link" | "arquivo">("link");
  const [enviando, setEnviando] = useState<null | "arquivo" | "capa" | "capaPasta">(null);

  // Abertura: controlada pelo pai quando ele manda, com estado próprio de
  // reserva — a tela do aluno não tem menu "Criar".
  const [matLocal, setMatLocal] = useState(false);
  const [pastaLocal, setPastaLocal] = useState(false);
  const matAberto = novoMaterial ?? matLocal;
  const pastaAberta = novaPasta ?? pastaLocal;
  const abrirMat = (v: boolean) => (onNovoMaterial ? onNovoMaterial(v) : setMatLocal(v));
  const abrirPasta = (v: boolean) => (onNovaPasta ? onNovaPasta(v) : setPastaLocal(v));

  // A chave carrega o `ver`: sem isso o cache do dono vaza para a visão do
  // aluno na prévia, e vice-versa.
  const { data, isLoading } = useQuery({
    queryKey: ["biblioteca", ver ?? null],
    queryFn: () => listaFn({ data: { preview_person_id: ver } }),
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["biblioteca"] });

  async function enviar(f: File, alvo: "arquivo" | "capa" | "capaPasta") {
    const limite = alvo === "arquivo" ? 25 : 3;
    if (f.size > limite * 1024 * 1024) {
      return toast.error(`Arquivo muito grande (máximo ${limite} MB).`);
    }
    setEnviando(alvo);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const ext = f.name.split(".").pop() ?? "bin";
      const caminho = `${sessao.user?.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("biblioteca").upload(caminho, f);
      if (error) throw new Error(error.message);
      const { data: pub } = supabase.storage.from("biblioteca").getPublicUrl(caminho);
      if (alvo === "capa") setForm((v) => ({ ...v, capa_url: pub.publicUrl }));
      else if (alvo === "capaPasta") setFormPasta((v) => ({ ...v, capa_url: pub.publicUrl }));
      else {
        // O título vem do nome do arquivo quando ainda está vazio: poupa
        // digitação e evita material sem nome. O tipo também é adivinhado pela
        // extensão — escolher "pdf" à mão depois de enviar um PDF é trabalho à toa.
        setForm((v) => ({
          ...v,
          url: pub.publicUrl,
          titulo: v.titulo || f.name.replace(/\.[^.]+$/, ""),
          kind: v.kind === "link" ? tipoPelaExtensao(ext) : v.kind,
        }));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(null);
    }
  }

  const salvar = useMutation({
    mutationFn: () =>
      salvarFn({
        data: {
          id: form.id,
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          url: form.url,
          kind: form.kind as (typeof TIPOS)[number],
          categoria: form.categoria || undefined,
          capa_url: form.capa_url || null,
          pasta_id: form.pasta_id,
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Material atualizado." : "Material adicionado.");
      inv();
      abrirMat(false);
      setForm(VAZIO);
      setOrigem("link");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarP = useMutation({
    mutationFn: () =>
      salvarPastaFn({
        data: {
          id: formPasta.id,
          titulo: formPasta.titulo,
          descricao: formPasta.descricao || null,
          capa_url: formPasta.capa_url || null,
        },
      }),
    onSuccess: () => {
      toast.success(formPasta.id ? "Pasta atualizada." : "Pasta criada.");
      inv();
      abrirPasta(false);
      setFormPasta({ id: undefined, titulo: "", descricao: "", capa_url: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => { toast.success("Material removido."); inv(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const excluirP = useMutation({
    mutationFn: (id: string) => excluirPastaFn({ data: { id } }),
    onSuccess: () => { toast.success("Pasta removida. O material voltou para a raiz."); inv(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mover = useMutation({
    mutationFn: (v: { id: string; direcao: "cima" | "baixo" }) => moverPastaFn({ data: v }),
    onSuccess: inv,
    onError: (e: Error) => toast.error(e.message),
  });

  const pastas = (data?.pastas ?? []) as Pasta[];
  const todos = (data?.materiais ?? []) as Material[];
  const termo = busca.trim().toLowerCase();
  const filtra = (m: Material) =>
    (!categoria || m.categoria === categoria) &&
    (!termo ||
      m.titulo.toLowerCase().includes(termo) ||
      (m.descricao ?? "").toLowerCase().includes(termo));

  const lista = todos.filter(filtra);
  const soltos = lista.filter((m) => !m.pasta_id);
  const nada = pastas.length === 0 && todos.length === 0;

  function editarMaterial(m: Material) {
    setForm({
      id: m.id, titulo: m.titulo, descricao: m.descricao ?? "", url: m.url, kind: m.kind,
      categoria: m.categoria ?? "", capa_url: m.capa_url ?? "", pasta_id: m.pasta_id,
    });
    setOrigem(m.url.includes("/storage/v1/object/public/biblioteca/") ? "arquivo" : "link");
    abrirMat(true);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">Biblioteca</h2>
          <p className="text-sm text-muted-foreground">
            Material que fica disponível independente das aulas.
          </p>
        </div>
        {podeEditar && !onNovoMaterial && (
          <Button size="sm" className="ml-auto" onClick={() => { setForm(VAZIO); abrirMat(true); }}>
            <Plus className="size-4" /> Adicionar material
          </Button>
        )}
      </div>

      {todos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar material" className="pl-8" />
          </div>
          {(data?.categorias ?? []).map((c) => (
            <button
              key={c}
              onClick={() => setCategoria(categoria === c ? null : c)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                categoria === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && nada && (
        <div className="rounded-xl border border-dashed border-black/10 p-10 text-center">
          <Paperclip className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {podeEditar
              ? "Nada aqui ainda. Crie uma pasta ou adicione um material solto."
              : "Seu mentor ainda não publicou material aqui."}
          </p>
        </div>
      )}

      {/* -------- Pastas -------- */}
      <div className="space-y-3">
        {pastas.map((p, i) => (
          <PastaBloco
            key={p.id} pasta={p} podeEditar={podeEditar} ehPrimeira={i === 0}
            ehUltima={i === pastas.length - 1}
            materiais={lista.filter((m) => m.pasta_id === p.id)}
            onEditar={() => {
              setFormPasta({
                id: p.id, titulo: p.titulo, descricao: p.descricao ?? "", capa_url: p.capa_url ?? "",
              });
              abrirPasta(true);
            }}
            onExcluir={() => excluirP.mutate(p.id)}
            onMover={(d) => mover.mutate({ id: p.id, direcao: d })}
            onEditarMaterial={editarMaterial}
            onExcluirMaterial={(id) => excluir.mutate(id)}
            onAdicionarAqui={() => { setForm({ ...VAZIO, pasta_id: p.id }); abrirMat(true); }}
          />
        ))}
      </div>

      {/* -------- Material solto -------- */}
      {soltos.length > 0 && (
        <div className="space-y-2">
          {pastas.length > 0 && (
            <h3 className="text-sm font-medium text-muted-foreground">Fora de pasta</h3>
          )}
          <GradeMateriais
            materiais={soltos} podeEditar={podeEditar}
            onEditar={editarMaterial} onExcluir={(id) => excluir.mutate(id)}
          />
        </div>
      )}

      {!isLoading && !nada && lista.length === 0 && pastas.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nada encontrado com esse filtro.
        </p>
      )}

      {/* -------- Diálogo do material -------- */}
      <Dialog open={matAberto} onOpenChange={(v) => { abrirMat(v); if (!v) setForm(VAZIO); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar material" : "Novo material"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="b-tit">Título</Label>
              <Input id="b-tit" value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <div className="mt-1 inline-flex rounded-lg bg-muted p-1">
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
                <Input className="mt-2" value={form.url} placeholder="https://…"
                  onChange={(e) => setForm({ ...form, url: e.target.value })} />
              ) : form.url ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/60 p-2.5 text-sm">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">Arquivo enviado</span>
                  <button type="button" onClick={() => setForm({ ...form, url: "" })} title="Remover">
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                  <Upload className="size-4" />
                  {enviando === "arquivo" ? "Enviando…" : "Escolher arquivo (até 25 MB)"}
                  <input type="file" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f, "arquivo"); }} />
                </label>
              )}
            </div>

            <div>
              <Label>Capa (opcional)</Label>
              {form.capa_url ? (
                <div className="relative mt-1 overflow-hidden rounded-lg">
                  <img src={form.capa_url} alt="" className="h-24 w-full object-cover" />
                  <button type="button" onClick={() => setForm({ ...form, capa_url: "" })}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                    title="Remover capa">
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                  <ImageIcon className="size-4" />
                  {enviando === "capa" ? "Enviando…" : "JPG ou PNG (até 3 MB)"}
                  <input type="file" accept="image/jpeg,image/png" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f, "capa"); }} />
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="b-tipo">Tipo</Label>
                <select
                  id="b-tipo" value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-black/10 bg-background px-2 text-sm"
                >
                  {TIPOS.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t] ?? t}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="b-pasta">Pasta</Label>
                <select
                  id="b-pasta" value={form.pasta_id ?? ""}
                  onChange={(e) => setForm({ ...form, pasta_id: e.target.value || null })}
                  className="mt-1 h-9 w-full rounded-md border border-black/10 bg-background px-2 text-sm"
                >
                  <option value="">Fora de pasta</option>
                  {pastas.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="b-cat">Categoria (opcional)</Label>
              <Input id="b-cat" value={form.categoria} placeholder="Liderança, Vendas…"
                onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="b-desc">Descrição (opcional)</Label>
              <Textarea id="b-desc" rows={2} value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>

            {/* Só depois de existir: destino precisa de id para gravar. */}
            {form.id ? (
              <Destinos alvo="material" id={form.id} />
            ) : (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                {form.pasta_id
                  ? "Vai herdar o acesso da pasta. Depois de salvar dá para restringir só este material."
                  : "Nasce liberado para todos os alunos. Depois de salvar dá para escolher quem vê."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => salvar.mutate()}
              disabled={!form.titulo.trim() || !form.url.trim() || salvar.isPending || !!enviando}>
              {salvar.isPending ? "Salvando…" : form.id ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------- Diálogo da pasta -------- */}
      <Dialog open={pastaAberta} onOpenChange={(v) => {
        abrirPasta(v);
        if (!v) setFormPasta({ id: undefined, titulo: "", descricao: "", capa_url: "" });
      }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formPasta.id ? "Editar pasta" : "Nova pasta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="p-tit">Nome da pasta</Label>
              <Input id="p-tit" value={formPasta.titulo} placeholder="Ex.: Livros de liderança"
                onChange={(e) => setFormPasta({ ...formPasta, titulo: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="p-desc">Descrição (opcional)</Label>
              <Textarea id="p-desc" rows={2} value={formPasta.descricao}
                onChange={(e) => setFormPasta({ ...formPasta, descricao: e.target.value })} />
            </div>
            <div>
              <Label>Capa (opcional)</Label>
              {formPasta.capa_url ? (
                <div className="relative mt-1 overflow-hidden rounded-lg">
                  <img src={formPasta.capa_url} alt="" className="h-24 w-full object-cover" />
                  <button type="button" onClick={() => setFormPasta({ ...formPasta, capa_url: "" })}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                    title="Remover capa">
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                  <ImageIcon className="size-4" />
                  {enviando === "capaPasta" ? "Enviando…" : "JPG ou PNG (até 3 MB)"}
                  <input type="file" accept="image/jpeg,image/png" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f, "capaPasta"); }} />
                </label>
              )}
            </div>
            {formPasta.id ? (
              <Destinos alvo="pasta" id={formPasta.id} />
            ) : (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                A pasta nasce liberada para todos os alunos. Depois de criar dá para escolher quem vê.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => salvarP.mutate()}
              disabled={!formPasta.titulo.trim() || salvarP.isPending || !!enviando}>
              {salvarP.isPending ? "Salvando…" : formPasta.id ? "Salvar" : "Criar pasta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Adivinha o tipo pela extensão — escolher à mão depois de enviar é trabalho à toa. */
function tipoPelaExtensao(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "pdf") return "pdf";
  if (["xls", "xlsx", "csv", "ods", "numbers"].includes(e)) return "planilha";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "svg"].includes(e)) return "imagem";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(e)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg"].includes(e)) return "audio";
  return "outro";
}

function PastaBloco({
  pasta, materiais, podeEditar, ehPrimeira, ehUltima,
  onEditar, onExcluir, onMover, onEditarMaterial, onExcluirMaterial, onAdicionarAqui,
}: {
  pasta: Pasta; materiais: Material[]; podeEditar: boolean;
  ehPrimeira: boolean; ehUltima: boolean;
  onEditar: () => void; onExcluir: () => void; onMover: (d: "cima" | "baixo") => void;
  onEditarMaterial: (m: Material) => void; onExcluirMaterial: (id: string) => void;
  onAdicionarAqui: () => void;
}) {
  const [aberta, setAberta] = useState(true);
  const trancada = !pasta.liberada;

  // Agrupado por formato, na ordem fixa de ORDEM_TIPOS: foi o pedido dele —
  // os PDFs juntos, as planilhas juntas, as imagens juntas.
  const grupos = useMemo(() => {
    const por = new Map<string, Material[]>();
    for (const m of materiais) {
      const k = m.kind in ICONE ? m.kind : "outro";
      por.set(k, [...(por.get(k) ?? []), m]);
    }
    return ORDEM_TIPOS.filter((t) => por.has(t)).map((t) => [t, por.get(t)!] as const);
  }, [materiais]);

  return (
    <div className={cn(
      "overflow-hidden rounded-xl ring-1 ring-black/5",
      trancada ? "bg-muted/40" : "bg-card",
    )}>
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => !trancada && setAberta((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          disabled={trancada}
        >
          {trancada ? (
            <Lock className="size-5 shrink-0 text-muted-foreground" />
          ) : aberta ? (
            <FolderOpen className="size-5 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="size-5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{pasta.titulo}</p>
            <p className="truncate text-xs text-muted-foreground">
              {trancada
                ? "Não liberada para você"
                : pasta.descricao || `${materiais.length} item${materiais.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </button>

        {podeEditar && (
          <div className="flex shrink-0 items-center gap-1">
            {!!pasta.destinos_count && (
              <span className="mr-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Users className="size-2.5" /> {pasta.destinos_count} com acesso
              </span>
            )}
            <Button variant="ghost" size="sm" title="Adicionar material nesta pasta"
              onClick={onAdicionarAqui}>
              <Plus className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" title="Editar pasta" onClick={onEditar}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" title="Subir" disabled={ehPrimeira}
              onClick={() => onMover("cima")}>
              <ChevronUp className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" title="Descer" disabled={ehUltima}
              onClick={() => onMover("baixo")}>
              <ChevronDown className="size-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive" title="Remover pasta">
                  <Trash2 className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover “{pasta.titulo}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {pasta.materiais_count > 0
                      ? `Os ${pasta.materiais_count} materiais dela NÃO são apagados — voltam para fora de pasta, e com isso ficam liberados para quem a pasta trancava.`
                      : "A pasta está vazia. Nada mais é afetado."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onExcluir}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {aberta && !trancada && (
        <div className="space-y-4 border-t border-black/5 px-4 pb-4 pt-3">
          {materiais.length === 0 ? (
            <p className="text-xs text-muted-foreground">Pasta vazia.</p>
          ) : (
            grupos.map(([tipo, itens]) => (
              <div key={tipo}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {ROTULO_TIPO[tipo] ?? tipo} · {itens.length}
                </p>
                <GradeMateriais
                  materiais={itens} podeEditar={podeEditar}
                  onEditar={onEditarMaterial} onExcluir={onExcluirMaterial}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function GradeMateriais({
  materiais, podeEditar, onEditar, onExcluir,
}: {
  materiais: Material[]; podeEditar: boolean;
  onEditar: (m: Material) => void; onExcluir: (id: string) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {materiais.map((m) => {
        const Icone = ICONE[m.kind as keyof typeof ICONE] ?? Paperclip;
        const trancado = !m.liberado;
        return (
          <li
            key={m.id}
            className={cn(
              "group relative rounded-xl p-4 ring-1 ring-black/5",
              trancado ? "bg-muted/40" : "bg-card",
            )}
          >
            {trancado ? (
              // Sem <a>: o link é o que a tranca tira. A capa fica visível para
              // ele saber que existe.
              <div>
                {m.capa_url && (
                  <img src={m.capa_url} alt=""
                    className="-mt-1 mb-3 h-28 w-full rounded-lg object-cover grayscale" />
                )}
                <Lock className="size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium leading-snug">{m.titulo}</p>
                <p className="mt-1 text-xs text-muted-foreground">Não liberado para você</p>
              </div>
            ) : (
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="block">
                {m.capa_url && (
                  <img src={m.capa_url} alt=""
                    className="-mt-1 mb-3 h-28 w-full rounded-lg object-cover" />
                )}
                <Icone className="size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium leading-snug">{m.titulo}</p>
                {m.descricao && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.descricao}</p>
                )}
                {m.categoria && (
                  <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {m.categoria}
                  </span>
                )}
              </a>
            )}
            {podeEditar && (
              <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                {!!m.destinos_count && (
                  <span className="mr-1 inline-flex items-center gap-1 self-center rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    <Users className="size-2.5" /> {m.destinos_count}
                  </span>
                )}
                <button onClick={() => onEditar(m)} title="Editar"
                  className="rounded p-1 text-muted-foreground hover:text-foreground">
                  <Pencil className="size-3.5" />
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button title="Remover"
                      className="rounded p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover “{m.titulo}”?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O material sai da biblioteca de todo mundo. Não dá para desfazer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onExcluir(m.id)}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Quem tem acesso a esta pasta / a este material.
 *
 * Guarda `null` até os destinos chegarem: gravar antes disso mandaria lista
 * vazia e abriria o que estava trancado — o mesmo cuidado do diálogo da trilha.
 */
function Destinos({ alvo, id }: { alvo: "pasta" | "material"; id: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getDestinosBiblioteca);
  const setFn = useServerFn(setDestinosBiblioteca);
  const { data } = useQuery({
    queryKey: ["bib-destinos", alvo, id],
    queryFn: () => getFn({ data: { alvo, id } }),
  });
  const [grupos, setGrupos] = useState<string[] | null>(null);
  const [pessoas, setPessoas] = useState<string[] | null>(null);
  useEffect(() => {
    if (!data) return;
    setGrupos((v) => v ?? data.group_ids);
    setPessoas((v) => v ?? data.person_ids);
  }, [data]);

  const salvar = useMutation({
    mutationFn: () =>
      setFn({ data: { alvo, id, group_ids: grupos ?? [], person_ids: pessoas ?? [] } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bib-destinos", alvo, id] });
      qc.invalidateQueries({ queryKey: ["biblioteca"] });
      toast.success("Acesso atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudou =
    !!data && grupos !== null && pessoas !== null &&
    (JSON.stringify([...grupos].sort()) !== JSON.stringify([...data.group_ids].sort()) ||
      JSON.stringify([...pessoas].sort()) !== JSON.stringify([...data.person_ids].sort()));

  return (
    <div className="space-y-2 border-t border-black/5 pt-3">
      <QuemAcessa
        grupos={grupos ?? []} pessoas={pessoas ?? []}
        setGrupos={setGrupos} setPessoas={setPessoas}
      />
      {alvo === "material" && (
        <p className="text-[11px] text-muted-foreground">
          Dentro de uma pasta, a pasta manda: aqui dá para restringir mais, nunca liberar mais.
        </p>
      )}
      <Button size="sm" variant="outline" disabled={!mudou || salvar.isPending}
        onClick={() => salvar.mutate()}>
        {salvar.isPending ? "Salvando…" : "Salvar acesso"}
      </Button>
    </div>
  );
}
