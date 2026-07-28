/**
 * O feed de um grupo.
 *
 * Um componente só, usado pelo painel do aluno e pela aba dentro do grupo. A
 * comunidade é a mesma para os dois — o que muda é por onde se chega, e o dono
 * ganha o poder de apagar o que não deveria estar lá.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarFeed, publicarPost, comentar, alternarCurtida, apagarPost, apagarComentario,
} from "@/lib/comunidade.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Paperclip, Trash2, FileText, X, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { youtubeId } from "@/lib/learning.functions";

const LIMITE_MB = 8;

function quando(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * @param grupos     todos os grupos que a pessoa alcança
 * @param escolherDestino  true para o dono, que decide para onde vai cada post.
 *   O avaliado não escolhe: o que ele publica vai para todos os grupos dele,
 *   por decisão do Matheus.
 */
export function Comunidade({
  grupos,
  escolherDestino = false,
  somenteLeitura = false,
}: {
  grupos: Array<{ id: string; name: string }>;
  escolherDestino?: boolean;
  /** Prévia "Ver como aluno": mostra o feed, mas não deixa publicar em nome dele. */
  somenteLeitura?: boolean;
}) {
  const qc = useQueryClient();
  const feedFn = useServerFn(listarFeed);
  const publicarFn = useServerFn(publicarPost);
  const comentarFn = useServerFn(comentar);
  const curtirFn = useServerFn(alternarCurtida);
  const apagarFn = useServerFn(apagarPost);
  const apagarComentarioFn = useServerFn(apagarComentario);

  const [texto, setTexto] = useState("");
  const [link, setLink] = useState("");
  const [arquivo, setArquivo] = useState<{ url: string; kind: "imagem" | "pdf"; nome: string } | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [comentando, setComentando] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Destino do post. Para o avaliado é sempre tudo; para o dono, o que ele marcar.
  const [destino, setDestino] = useState<string[]>(grupos.map((g) => g.id));
  // Limita aos grupos recebidos. Importa na prévia: quem está autenticado é o
  // dono, e sem o filtro o feed traria posts de grupos que o aluno não tem.
  const idsDosGrupos = grupos.map((g) => g.id);
  const chave = ["feed", idsDosGrupos.join(",")];
  const { data, isLoading } = useQuery({
    queryKey: chave,
    queryFn: () => feedFn({ data: { group_ids: idsDosGrupos } }),
    enabled: idsDosGrupos.length > 0,
  });
  const recarregar = () => qc.invalidateQueries({ queryKey: chave });

  async function escolherArquivo(f: File) {
    const ehImagem = f.type.startsWith("image/");
    const ehPdf = f.type === "application/pdf";
    if (!ehImagem && !ehPdf) return toast.error("Só imagem ou PDF, por enquanto.");
    if (f.size > LIMITE_MB * 1024 * 1024) return toast.error(`O arquivo passa de ${LIMITE_MB} MB.`);
    setEnviandoArquivo(true);
    const { data: sess } = await supabase.auth.getUser();
    const uid = sess.user?.id;
    if (!uid) { setEnviandoArquivo(false); return toast.error("Sessão expirada. Entre de novo."); }
    // Pasta com o id do usuário: a policy do bucket só deixa escrever na própria.
    const caminho = `${uid}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("comunidade").upload(caminho, f, { upsert: false });
    setEnviandoArquivo(false);
    if (error) return toast.error(error.message);
    const { data: pub } = supabase.storage.from("comunidade").getPublicUrl(caminho);
    setArquivo({ url: pub.publicUrl, kind: ehImagem ? "imagem" : "pdf", nome: f.name });
  }

  const publicar = useMutation({
    mutationFn: () =>
      publicarFn({
        data: {
          group_ids: escolherDestino ? destino : grupos.map((g) => g.id),
          body: texto,
          file_url: arquivo?.url ?? null,
          file_kind: arquivo?.kind ?? null,
          link_url: link.trim() || null,
        },
      }),
    onSuccess: () => {
      setTexto(""); setLink(""); setArquivo(null);
      if (fileRef.current) fileRef.current.value = "";
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const curtir = useMutation({
    mutationFn: (v: { post_id: string; curtir: boolean }) => curtirFn({ data: v }),
    onSuccess: recarregar,
  });
  const enviarComentario = useMutation({
    mutationFn: (v: { post_id: string; body: string }) => comentarFn({ data: v }),
    onSuccess: (_r, v) => { setComentando((c) => ({ ...c, [v.post_id]: "" })); recarregar(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const apagar = useMutation({
    mutationFn: (id: string) => apagarFn({ data: { id } }),
    onSuccess: () => { toast.success("Publicação removida."); recarregar(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const apagarCom = useMutation({
    mutationFn: (id: string) => apagarComentarioFn({ data: { id } }),
    onSuccess: recarregar,
    onError: (e: Error) => toast.error(e.message),
  });

  const posts = data?.posts ?? [];

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------- escrever --- */}
      {!somenteLeitura && (
      <div className="rounded-xl border border-black/5 bg-card p-4">
        <Textarea
          value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
          placeholder="Compartilhe algo com o grupo…"
        />
        {arquivo && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
            {arquivo.kind === "imagem"
              ? <img src={arquivo.url} alt="" className="size-10 rounded object-cover" />
              : <FileText className="size-5 text-muted-foreground" />}
            <span className="min-w-0 flex-1 truncate">{arquivo.nome}</span>
            <button onClick={() => setArquivo(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        )}
        <Input
          value={link} onChange={(e) => setLink(e.target.value)}
          placeholder="Link (opcional)" className="mt-3"
        />
        <input
          ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void escolherArquivo(f); }}
        />
        {escolherDestino && grupos.length > 1 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">Publicar em</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {grupos.map((g) => {
                const marcado = destino.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => setDestino((d) => marcado ? d.filter((x) => x !== g.id) : [...d, g.id])}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs transition",
                      marcado ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                    )}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={enviandoArquivo}>
            <Paperclip className="size-3.5" /> {enviandoArquivo ? "Enviando…" : "Imagem ou PDF"}
          </Button>
          <Button
            size="sm"
            onClick={() => publicar.mutate()}
            disabled={
              publicar.isPending
              || texto.trim().length === 0
              || (escolherDestino ? destino.length === 0 : grupos.length === 0)
            }
          >
            <Send className="size-3.5" /> {publicar.isPending ? "Publicando…" : "Publicar"}
          </Button>
        </div>
      </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && posts.length === 0 && (
        <p className="rounded-xl bg-muted/40 p-6 text-sm text-muted-foreground">
          Ninguém publicou nada ainda. A primeira publicação costuma ser a mais difícil — e é a que
          faz o resto do grupo começar.
        </p>
      )}

      {/* ---------------------------------------------------- feed --- */}
      {posts.map((p) => (
        <article key={p.id} className="rounded-xl border border-black/5 bg-card p-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{p.author_name}</p>
              {grupos.length > 1 && p.grupos.length > 0 && (
                <p className="truncate text-xs text-muted-foreground">{p.grupos.join(" · ")}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{quando(p.created_at)}</span>
              <button
                onClick={() => apagar.mutate(p.id)}
                className="text-muted-foreground hover:text-destructive"
                title={p.meu ? "Apagar minha publicação" : "Remover do grupo"}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.body}</p>

          {p.file_url && p.file_kind === "imagem" && (
            <img src={p.file_url} alt="" className="mt-3 max-h-96 w-full rounded-lg object-cover" />
          )}
          {p.file_url && p.file_kind === "pdf" && (
            <a
              href={p.file_url} target="_blank" rel="noreferrer"
              className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm hover:bg-muted"
            >
              <FileText className="size-4" /> Abrir o PDF
            </a>
          )}
          {/* Link do YouTube vira o vídeo. Um link cru no meio do feed não
              convida ninguém a clicar; a prévia é o que faz o conteúdo
              circular. Reusa o mesmo leitor de id da Educação. */}
          {p.link_url && youtubeId(p.link_url) && (
            <div className="mt-3 aspect-video overflow-hidden rounded-lg bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId(p.link_url)}`}
                title="Vídeo"
                className="size-full"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          )}
          {p.link_url && !youtubeId(p.link_url) && (
            <a
              href={p.link_url} target="_blank" rel="noreferrer"
              className="mt-3 block truncate text-sm text-primary hover:underline"
            >
              {p.link_url}
            </a>
          )}

          <div className="mt-3 flex items-center gap-4 border-t border-black/5 pt-3">
            <button
              onClick={() => curtir.mutate({ post_id: p.id, curtir: !p.curti })}
              className={cn("flex items-center gap-1.5 text-sm", p.curti ? "text-red-600" : "text-muted-foreground hover:text-foreground")}
            >
              <Heart className={cn("size-4", p.curti && "fill-current")} /> {p.curtidas > 0 ? p.curtidas : ""}
            </button>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageCircle className="size-4" /> {p.comentarios.length > 0 ? p.comentarios.length : ""}
            </span>
          </div>

          {p.comentarios.length > 0 && (
            <ul className="mt-3 space-y-2">
              {p.comentarios.map((c) => (
                <li key={c.id} className="rounded-lg bg-muted/40 p-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{c.author_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{quando(c.created_at)}</span>
                      <button onClick={() => apagarCom.mutate(c.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex gap-2">
            <Input
              value={comentando[p.id] ?? ""}
              onChange={(e) => setComentando((c) => ({ ...c, [p.id]: e.target.value }))}
              placeholder="Escreva um comentário…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (comentando[p.id] ?? "").trim()) {
                  enviarComentario.mutate({ post_id: p.id, body: comentando[p.id] });
                }
              }}
            />
            <Button
              size="sm" variant="outline"
              disabled={!(comentando[p.id] ?? "").trim()}
              onClick={() => enviarComentario.mutate({ post_id: p.id, body: comentando[p.id] })}
            >
              Enviar
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
