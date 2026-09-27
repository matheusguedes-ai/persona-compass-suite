/**
 * #313 — Os formulários de pasta e de material da Biblioteca (menu próprio).
 *
 * O envio de arquivo e de capa é o mesmo que já funcionava dentro da Academy: o navegador sobe o
 * arquivo para a pasta do DONO no bucket privado `biblioteca` e guarda só o identificador; o link de
 * verdade é assinado pelo servidor, e só para quem o banco disser que pode ver.
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RecortarImagem } from "@/components/recorte-imagem";
import { Image as ImageIcon, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erro-legivel";
import { ACCEPT, CAMPOS, avisoDoCampo, erroDeArquivo, erroDeUpload } from "@/lib/erro-de-upload";
import { supabase } from "@/integrations/supabase/client";
import { assinarMeuEnvio } from "@/lib/preview-upload.functions";
import { salvarMaterial, salvarPastaDoAcervo, TIPOS, ROTULO_TIPO } from "@/lib/biblioteca.functions";
import { emOrdemDeArvore, type PastaNo } from "@/components/biblioteca/arvore";

const LIMITE_MB = 25;

/** Sobe um arquivo para a pasta do dono no bucket e devolve o IDENTIFICADOR (não um link). */
async function enviarParaOBucket(f: File): Promise<string> {
  const { data: sessao } = await supabase.auth.getUser();
  const ext = f.name.split(".").pop() ?? "bin";
  const caminho = `${sessao.user?.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("biblioteca").upload(caminho, f);
  if (error) throw new Error(erroDeUpload(error, "biblioteca"));
  return supabase.storage.from("biblioteca").getPublicUrl(caminho).data.publicUrl;
}

/** Adivinha o formato pela extensão — escolher à mão depois de enviar é trabalho à toa. */
function tipoPelaExtensao(nome: string): string {
  const e = (nome.split(".").pop() ?? "").toLowerCase();
  if (e === "pdf") return "pdf";
  if (["xls", "xlsx", "csv", "ods", "numbers"].includes(e)) return "planilha";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "svg"].includes(e)) return "imagem";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(e)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg"].includes(e)) return "audio";
  return "outro";
}

function CampoCapa({
  valor, previa, enviando, onEscolher, onRemover,
}: {
  valor: string; previa: string | null; enviando: boolean;
  onEscolher: (f: File) => void; onRemover: () => void;
}) {
  return (
    <div>
      <Label>Capa (opcional)</Label>
      {valor ? (
        <div className="relative mt-1 overflow-hidden rounded-lg">
          <img src={previa ?? valor} alt="" className="h-24 w-full object-cover" />
          <button type="button" onClick={onRemover} title="Remover capa"
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
          <ImageIcon className="size-4" />
          {enviando ? "Enviando…" : "Escolher imagem"}
          <input type="file" accept={CAMPOS.capa_material.accept} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onEscolher(f); e.target.value = ""; }} />
        </label>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">{avisoDoCampo("capa_material")}</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ pasta
export type PastaEditavel = { id: string; titulo: string; descricao: string | null; capa_url: string | null };

export function FormularioPasta({
  aberto, onFechar, inicial, maeId, nomeDaMae, onSalvo,
}: {
  aberto: boolean; onFechar: () => void; inicial: PastaEditavel | null;
  /** Onde a pasta nova nasce (null = início da Biblioteca). */
  maeId: string | null; nomeDaMae: string | null; onSalvo: () => void;
}) {
  const salvarFn = useServerFn(salvarPastaDoAcervo);
  const previaFn = useServerFn(assinarMeuEnvio);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [capa, setCapa] = useState("");
  const [previa, setPrevia] = useState<string | null>(null);
  const [recortar, setRecortar] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTitulo(inicial?.titulo ?? ""); setDescricao(inicial?.descricao ?? "");
    setCapa(inicial?.capa_url ?? ""); setPrevia(null);
  }, [aberto, inicial]);

  async function enviarCapa(f: File) {
    const erro = erroDeArquivo(f, "capa_material");
    if (erro) return toast.error(erro);
    setEnviando(true);
    try {
      const id = await enviarParaOBucket(f);
      setCapa(id);
      try { setPrevia((await previaFn({ data: { url: id } })).url); } catch { setPrevia(null); }
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const salvar = useMutation({
    mutationFn: () => salvarFn({
      data: { id: inicial?.id, titulo, descricao: descricao || null, capa_url: capa || null, pasta_mae_id: inicial ? undefined : maeId },
    }),
    onSuccess: () => { toast.success(inicial ? "Pasta atualizada." : "Pasta criada."); onSalvo(); onFechar(); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return (
    <>
      <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{inicial ? "Editar pasta" : "Nova pasta"}</DialogTitle>
            {!inicial && (
              <DialogDescription>
                {nomeDaMae ? `Dentro de "${nomeDaMae}". Ela segue o acesso de lá.` : "No início da Biblioteca. Ela segue o menu Biblioteca."}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bp-tit">Nome da pasta</Label>
              <Input id="bp-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Livros de liderança" />
            </div>
            <div>
              <Label htmlFor="bp-desc">Descrição (opcional)</Label>
              <Textarea id="bp-desc" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <CampoCapa valor={capa} previa={previa} enviando={enviando}
              onEscolher={(f) => setRecortar(f)} onRemover={() => { setCapa(""); setPrevia(null); }} />
          </div>
          <DialogFooter>
            <Button onClick={() => salvar.mutate()} disabled={!titulo.trim() || salvar.isPending || enviando}>
              {salvar.isPending ? "Salvando…" : inicial ? "Salvar" : "Criar pasta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RecortarImagem arquivo={recortar} aspecto={16 / 9} onCancelar={() => setRecortar(null)}
        onConcluir={(f) => { setRecortar(null); enviarCapa(f); }} />
    </>
  );
}

// --------------------------------------------------------------------------------------- material
export type MaterialEditavel = {
  id: string; titulo: string; descricao: string | null; url: string; kind: string;
  categoria: string | null; capa_url: string | null; pasta_id: string | null; arquivo_proprio: boolean;
};

export function FormularioMaterial({
  aberto, onFechar, inicial, pastaPadrao, pastas, onSalvo,
}: {
  aberto: boolean; onFechar: () => void; inicial: MaterialEditavel | null;
  /** Onde o material novo nasce (a pasta aberta na tela). */
  pastaPadrao: string | null; pastas: PastaNo[]; onSalvo: () => void;
}) {
  const salvarFn = useServerFn(salvarMaterial);
  const previaFn = useServerFn(assinarMeuEnvio);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("link");
  const [categoria, setCategoria] = useState("");
  const [capa, setCapa] = useState("");
  const [previa, setPrevia] = useState<string | null>(null);
  const [pastaId, setPastaId] = useState<string | null>(null);
  const [origem, setOrigem] = useState<"link" | "arquivo">("link");
  const [enviando, setEnviando] = useState<null | "arquivo" | "capa">(null);
  const [recortar, setRecortar] = useState<File | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setTitulo(inicial?.titulo ?? ""); setDescricao(inicial?.descricao ?? ""); setUrl(inicial?.url ?? "");
    setKind(inicial?.kind ?? "link"); setCategoria(inicial?.categoria ?? ""); setCapa(inicial?.capa_url ?? "");
    setPrevia(null); setPastaId(inicial ? inicial.pasta_id : pastaPadrao);
    setOrigem(inicial?.arquivo_proprio ? "arquivo" : "link");
  }, [aberto, inicial, pastaPadrao]);

  async function enviarArquivo(f: File) {
    if (f.size > LIMITE_MB * 1024 * 1024) return toast.error(`Arquivo muito grande (máximo ${LIMITE_MB} MB).`);
    setEnviando("arquivo");
    try {
      const id = await enviarParaOBucket(f);
      setUrl(id);
      setTitulo((t) => t || f.name.replace(/\.[^.]+$/, ""));
      setKind((k) => (k === "link" ? tipoPelaExtensao(f.name) : k));
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(null);
    }
  }

  async function enviarCapa(f: File) {
    const erro = erroDeArquivo(f, "capa_material");
    if (erro) return toast.error(erro);
    setEnviando("capa");
    try {
      const id = await enviarParaOBucket(f);
      setCapa(id);
      try { setPrevia((await previaFn({ data: { url: id } })).url); } catch { setPrevia(null); }
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(null);
    }
  }

  const salvar = useMutation({
    mutationFn: () => salvarFn({
      data: {
        id: inicial?.id, titulo, descricao: descricao || undefined, url,
        kind: kind as (typeof TIPOS)[number], categoria: categoria || undefined,
        capa_url: capa || null, pasta_id: pastaId, arquivo_proprio: origem === "arquivo",
      },
    }),
    onSuccess: () => { toast.success(inicial ? "Material atualizado." : "Material adicionado."); onSalvo(); onFechar(); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const destinos = emOrdemDeArvore(pastas);

  return (
    <>
      <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{inicial ? "Editar material" : "Novo material"}</DialogTitle>
            <DialogDescription>
              Ele segue o acesso da pasta onde estiver. Depois de salvar, o item mostra quem vê — e dá para
              liberar ou bloquear pessoas e grupos só para ele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bm-tit">Título</Label>
              <Input id="bm-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <div className="mt-1 inline-flex rounded-lg bg-muted p-1">
                {(["link", "arquivo"] as const).map((o) => (
                  <button key={o} type="button" onClick={() => setOrigem(o)}
                    className={cn("min-h-9 rounded-md px-3 py-1 text-xs font-medium", origem === o ? "bg-background shadow-sm" : "text-muted-foreground")}>
                    {o === "link" ? "Colar link" : "Enviar arquivo"}
                  </button>
                ))}
              </div>
              {origem === "link" ? (
                <Input className="mt-2" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
              ) : url ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/60 p-2.5 text-sm">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">Arquivo enviado</span>
                  <button type="button" onClick={() => setUrl("")} title="Trocar arquivo" className="p-1">
                    <X className="size-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                  <Upload className="size-4" />
                  {enviando === "arquivo" ? "Enviando…" : `Escolher arquivo (até ${LIMITE_MB} MB)`}
                  <input type="file" accept={ACCEPT.biblioteca} className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarArquivo(f); e.target.value = ""; }} />
                </label>
              )}
            </div>
            <CampoCapa valor={capa} previa={previa} enviando={enviando === "capa"}
              onEscolher={(f) => setRecortar(f)} onRemover={() => { setCapa(""); setPrevia(null); }} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="bm-tipo">Formato</Label>
                <select id="bm-tipo" value={kind} onChange={(e) => setKind(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-black/10 bg-background px-2 text-sm">
                  {TIPOS.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t] ?? t}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="bm-pasta">Pasta</Label>
                <select id="bm-pasta" value={pastaId ?? ""} onChange={(e) => setPastaId(e.target.value || null)}
                  className="mt-1 h-10 w-full rounded-md border border-black/10 bg-background px-2 text-sm">
                  <option value="">Início da Biblioteca (sem pasta)</option>
                  {destinos.map(({ pasta, nivel }) => (
                    <option key={pasta.id} value={pasta.id}>{`${"— ".repeat(nivel - 1)}${pasta.titulo}`}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="bm-cat">Categoria (opcional)</Label>
              <Input id="bm-cat" value={categoria} placeholder="Liderança, Vendas…" onChange={(e) => setCategoria(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bm-desc">Descrição (opcional)</Label>
              <Textarea id="bm-desc" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => salvar.mutate()}
              disabled={!titulo.trim() || !url.trim() || salvar.isPending || !!enviando}>
              {salvar.isPending ? "Salvando…" : inicial ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RecortarImagem arquivo={recortar} aspecto={16 / 9} onCancelar={() => setRecortar(null)}
        onConcluir={(f) => { setRecortar(null); enviarCapa(f); }} />
    </>
  );
}
