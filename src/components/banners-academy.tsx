/**
 * Banners rotativos no topo da Academy.
 *
 * Rodam sozinhos a cada 6 segundos e param quando o mouse está em cima — banner
 * que troca no instante em que a pessoa vai clicar é a maneira mais rápida de
 * fazer alguém desistir de clicar.
 *
 * Com um banner só, não há setas nem bolinhas: controle de navegação para um
 * item só é ruído.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarBanners, salvarBanner, excluirBanner, moverBanner,
} from "@/lib/biblioteca.functions";
import { assinarMeuEnvio } from "@/lib/preview-upload.functions";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ImagePlus, Trash2, ChevronLeft, ChevronRight, Plus, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { erroDeUpload } from "@/lib/erro-de-upload";
import { RecortarImagem } from "@/components/recorte-imagem";

export function BannersAcademy({
  podeEditar = false, novo, onNovo,
}: {
  podeEditar?: boolean;
  /** Abertura controlada de fora — quem manda é o menu "Criar" do cabeçalho. */
  novo?: boolean;
  onNovo?: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const listaFn = useServerFn(listarBanners);
  const salvarFn = useServerFn(salvarBanner);
  const excluirFn = useServerFn(excluirBanner);
  const moverFn = useServerFn(moverBanner);
  const previaFn = useServerFn(assinarMeuEnvio);

  const [atual, setAtual] = useState(0);
  const [parado, setParado] = useState(false);
  const [abertoLocal, setAbertoLocal] = useState(false);
  const aberto = novo ?? abertoLocal;
  const setAberto = (v: boolean) => (onNovo ? onNovo(v) : setAbertoLocal(v));
  const [form, setForm] = useState({ imagem_url: "", link_url: "", titulo: "" });
  const [enviando, setEnviando] = useState(false);
  // O bucket é privado: form.imagem_url guarda o IDENTIFICADOR (o que salva).
  // Isto guarda a versão ASSINADA do upload desta sessão, só para o <img>.
  const [preview, setPreview] = useState<string | null>(null);
  // O arquivo escolhido passa pelo recorte antes de virar upload.
  const [paraRecortar, setParaRecortar] = useState<File | null>(null);

  const { data } = useQuery({ queryKey: ["banners"], queryFn: () => listaFn() });
  const banners = data?.banners ?? [];

  useEffect(() => {
    if (banners.length < 2 || parado) return;
    const t = setInterval(() => setAtual((v) => (v + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length, parado]);

  // Apagar o último banner deixaria o índice apontando para o vazio.
  useEffect(() => {
    if (atual >= banners.length) setAtual(0);
  }, [banners.length, atual]);

  async function enviarImagem(f: File) {
    if (f.size > 3 * 1024 * 1024) return toast.error("Imagem muito grande (máximo 3 MB).");
    setEnviando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const ext = f.name.split(".").pop() ?? "jpg";
      const caminho = `${sessao.user?.id}/banner-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("biblioteca").upload(caminho, f);
      if (error) throw new Error(erroDeUpload(error, "biblioteca"));
      const { data: pub } = supabase.storage.from("biblioteca").getPublicUrl(caminho);
      // Pede ao servidor o preview desta MESMA imagem que acabei de enviar —
      // o bucket privado não deixa o navegador assinar sozinho. Se falhar,
      // ainda salva certo; só o preview imediato fica sem imagem.
      try {
        setPreview((await previaFn({ data: { url: pub.publicUrl } })).url);
      } catch { /* sem preview agora */ }
      setForm((v) => ({ ...v, imagem_url: pub.publicUrl }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const salvar = useMutation({
    mutationFn: () =>
      salvarFn({
        data: {
          imagem_url: form.imagem_url,
          link_url: form.link_url.trim() || null,
          titulo: form.titulo.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Banner adicionado.");
      qc.invalidateQueries({ queryKey: ["banners"] });
      setAberto(false);
      setForm({ imagem_url: "", link_url: "", titulo: "" });
      setPreview(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acao = useMutation({
    mutationFn: async (v: { tipo: "excluir" | "mover"; id: string; direcao?: "cima" | "baixo" }) =>
      v.tipo === "excluir"
        ? excluirFn({ data: { id: v.id } })
        : moverFn({ data: { id: v.id, direcao: v.direcao! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["banners"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Sem banner e sem poder criar, a seção inteira some — não vale ocupar o topo
  // da tela com um vazio.
  if (banners.length === 0 && !podeEditar) return null;

  const b = banners[atual];

  return (
    <section className="space-y-2">
      {b && (
        <div
          className="relative overflow-hidden rounded-xl"
          onMouseEnter={() => setParado(true)}
          onMouseLeave={() => setParado(false)}
        >
          {b.link_url ? (
            <a href={b.link_url} target="_blank" rel="noopener noreferrer">
              <img src={b.imagem_url ?? undefined} alt={b.titulo ?? ""} className="h-44 w-full object-cover sm:h-56" />
            </a>
          ) : (
            <img src={b.imagem_url ?? undefined} alt={b.titulo ?? ""} className="h-44 w-full object-cover sm:h-56" />
          )}

          {b.titulo && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              <p className="text-sm font-medium text-white">{b.titulo}</p>
            </div>
          )}

          {banners.length > 1 && (
            <>
              <button
                onClick={() => setAtual((v) => (v - 1 + banners.length) % banners.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                aria-label="Anterior"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => setAtual((v) => (v + 1) % banners.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                aria-label="Próximo"
              >
                <ChevronRight className="size-4" />
              </button>
              <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
                {banners.map((_, i) => (
                  <button
                    key={i} onClick={() => setAtual(i)} aria-label={`Banner ${i + 1}`}
                    className={cn("h-1.5 rounded-full transition-all",
                      i === atual ? "w-5 bg-white" : "w-1.5 bg-white/50")}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {podeEditar && (
        // Sem o botão local (gatilho veio de fora) a linha não deve ocupar
        // espaço nenhum — mas o Dialog continua montado, senão o item do menu
        // "Criar" não teria o que abrir.
        <div className={onNovo ? "contents" : "flex flex-wrap items-center gap-2"}>
          <Dialog open={aberto} onOpenChange={setAberto}>
            {!onNovo && (
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" /> Banner
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo banner</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Imagem</Label>
                  {form.imagem_url ? (
                    <div className="relative mt-1 overflow-hidden rounded-lg">
                      <img src={preview ?? form.imagem_url} alt="" className="h-28 w-full object-cover" />
                      <button onClick={() => { setForm({ ...form, imagem_url: "" }); setPreview(null); }}
                        className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                      <ImagePlus className="size-4" />
                      {enviando ? "Enviando…" : "JPG ou PNG (até 3 MB)"}
                      <input type="file" accept="image/jpeg,image/png" className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setParaRecortar(f);
                          e.target.value = "";
                        }} />
                    </label>
                  )}
                </div>
                <div>
                  <Label htmlFor="bn-tit">Texto sobre a imagem (opcional)</Label>
                  <Input id="bn-tit" value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="bn-link">Link ao clicar (opcional)</Label>
                  <Input id="bn-link" value={form.link_url} placeholder="https://…"
                    onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => salvar.mutate()}
                  disabled={!form.imagem_url || salvar.isPending || enviando}>
                  {salvar.isPending ? "Salvando…" : "Adicionar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <RecortarImagem
            arquivo={paraRecortar}
            aspecto={3}
            onCancelar={() => setParaRecortar(null)}
            onConcluir={(recortado) => { setParaRecortar(null); enviarImagem(recortado); }}
          />

          {b && (
            <>
              <Button variant="ghost" size="sm" disabled={atual === 0}
                onClick={() => acao.mutate({ tipo: "mover", id: b.id, direcao: "cima" })}>
                <ChevronLeft className="size-3.5" /> Antes
              </Button>
              <Button variant="ghost" size="sm" disabled={atual === banners.length - 1}
                onClick={() => acao.mutate({ tipo: "mover", id: b.id, direcao: "baixo" })}>
                Depois <ChevronRight className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive"
                onClick={() => acao.mutate({ tipo: "excluir", id: b.id })}>
                <Trash2 className="size-3.5" /> Remover este
              </Button>
              <span className="text-xs text-muted-foreground">
                {atual + 1} de {banners.length}
              </span>
            </>
          )}
        </div>
      )}
    </section>
  );
}
