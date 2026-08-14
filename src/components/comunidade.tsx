/**
 * O feed de um grupo.
 *
 * Um componente só, usado pelo painel do aluno e pela aba dentro do grupo. A
 * comunidade é a mesma para os dois — o que muda é por onde se chega, e o dono
 * ganha o poder de apagar o que não deveria estar lá.
 */
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarFeed, publicarPost, comentar, alternarCurtida, apagarPost, apagarComentario,
  membrosDosGrupos, votarEnquete, eventosParaEscolher,
} from "@/lib/comunidade.functions";
import { detectarMencao, marcarPessoa } from "@/lib/mencoes";
import { assinarMeuEnvio } from "@/lib/preview-upload.functions";
import { supabase } from "@/integrations/supabase/client";
import { bloqueadoNoPreview } from "@/lib/preview-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/avatar-upload";
import { LadoDaComunidade } from "@/components/comunidade-lado";
import { PerfilColegaDialog } from "@/components/perfil-colega-dialog";
import { Heart, MessageCircle, Paperclip, Trash2, FileText, X, Send, BarChart3, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { youtubeId } from "@/lib/learning.functions";
import { ACCEPT, LIMITES, erroDeUpload } from "@/lib/erro-de-upload";

/**
 * Marcações @[Nome](person_id) viram texto destacado e clicável — abre o
 * mesmo cartão de perfil que a aba Membros já usa (#55). A marcação em si
 * fica só no texto salvo; aqui é só o desenho de volta em tela.
 */
function renderTextoComMencoes(texto: string, aoClicar: (personId: string) => void): ReactNode[] {
  const partes: ReactNode[] = [];
  const regex = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let chave = 0;
  while ((m = regex.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const nome = m[1];
    const id = m[2];
    partes.push(
      <button
        key={`mencao-${chave++}`}
        type="button"
        onClick={() => aoClicar(id)}
        className="font-medium text-primary hover:underline"
      >
        @{nome}
      </button>,
    );
    ultimo = regex.lastIndex;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/** Onde, no texto, o @ ativo está — post ou um comentário específico. */
type MencaoAlvo =
  | { tipo: "post"; inicio: number; termo: string }
  | { tipo: "comentario"; postId: string; inicio: number; termo: string };

// O MESMO numero do bucket. Antes era 8 aqui e 5 la: toda foto de celular
// entre 5 e 8 MB passava pela mensagem amigavel da tela, subia pela rede
// inteira e voltava com o erro cru do Supabase.
const LIMITE_MB = LIMITES.comunidade.tamanhoMb;

function quando(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Data e hora completas de um evento (#56) — diferente de `quando()` acima,
    que é relativo ("3h atrás"): aqui é sempre um momento absoluto. */
function dataDoEvento(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
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
  focoPostId,
  linkAgenda = "/agenda",
}: {
  grupos: Array<{ id: string; name: string }>;
  escolherDestino?: boolean;
  /** Prévia "Ver como aluno": mostra o feed, mas não deixa publicar em nome dele. */
  somenteLeitura?: boolean;
  /** Rota da Agenda de quem está vendo — o dono usa /agenda, o aluno usa
      /aluno/agenda (#56). Passada pela rota, não descoberta aqui. */
  linkAgenda?: string;
  /** Veio de uma notificação de menção — rola até este post ao carregar (#55). */
  focoPostId?: string;
}) {
  const qc = useQueryClient();
  const feedFn = useServerFn(listarFeed);
  const publicarFn = useServerFn(publicarPost);
  const comentarFn = useServerFn(comentar);
  const curtirFn = useServerFn(alternarCurtida);
  const apagarFn = useServerFn(apagarPost);
  const apagarComentarioFn = useServerFn(apagarComentario);
  const previaFn = useServerFn(assinarMeuEnvio);
  const membrosFn = useServerFn(membrosDosGrupos);
  const votarFn = useServerFn(votarEnquete);
  const eventosFn = useServerFn(eventosParaEscolher);

  const [texto, setTexto] = useState("");
  const [link, setLink] = useState("");
  // Enquete (#54): a pergunta é o próprio `texto` acima — isto só guarda as
  // opções, sempre entre 2 e 6.
  const [enquete, setEnquete] = useState(false);
  const [opcoesEnquete, setOpcoesEnquete] = useState<string[]>(["", ""]);
  // Qual opção está com a lista de votantes aberta agora — um slot só serve
  // qualquer enquete de qualquer post, porque option_id já é único.
  const [verVotantes, setVerVotantes] = useState<string | null>(null);
  // Evento como cartão (#56): mutuamente exclusivo com enquete — os dois
  // ligados ao mesmo tempo não fazem sentido no mesmo post.
  const [modoEvento, setModoEvento] = useState(false);
  const [eventoEscolhido, setEventoEscolhido] = useState<{ id: string; titulo: string } | null>(null);
  const { data: eventosData } = useQuery({
    queryKey: ["eventos-para-escolher"],
    queryFn: () => eventosFn(),
    enabled: modoEvento,
  });
  const [arquivo, setArquivo] = useState<{ url: string; kind: "imagem" | "pdf"; nome: string } | null>(null);
  // O bucket 'comunidade' é privado: arquivo.url guarda o IDENTIFICADOR (o que
  // salva). Isto guarda a versão ASSINADA do upload desta sessão, só para o
  // <img> de imagem ter o que mostrar antes de publicar — o PDF não precisa,
  // a prévia dele é só o ícone e o nome.
  const [arquivoPreview, setArquivoPreview] = useState<string | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [comentando, setComentando] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const textoRef = useRef<HTMLTextAreaElement>(null);
  const comentarioRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // O cartão de perfil de quem foi mencionado — mesmo cartão da aba Membros.
  const [vendoPerfil, setVendoPerfil] = useState<string | null>(null);

  // A menção com @ em andamento: em qual campo, a partir de onde, e o que já
  // foi digitado depois do @ (filtra a lista). Só um campo por vez tem foco,
  // então um slot só serve tanto o post quanto qualquer comentário.
  const [mencaoAtiva, setMencaoAtiva] = useState<MencaoAlvo | null>(null);
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);

  // Destino do post. Para o avaliado é sempre tudo; para o dono, o que ele marcar.
  //
  // `useState` só usa o valor inicial no primeiro render — e nesse instante os
  // grupos ainda estão carregando. Sem o efeito abaixo o destino ficava vazio
  // para sempre, e publicar falhava sem dizer por quê.
  const [destino, setDestino] = useState<string[]>([]);
  const assinaturaDosGrupos = grupos.map((g) => g.id).join(",");
  useEffect(() => {
    setDestino(grupos.map((g) => g.id));
  }, [assinaturaDosGrupos]);
  // Limita aos grupos recebidos. Importa na prévia: quem está autenticado é o
  // dono, e sem o filtro o feed traria posts de grupos que o aluno não tem.
  const idsDosGrupos = grupos.map((g) => g.id);
  const chave = ["feed", idsDosGrupos.join(",")];
  const { data, isLoading, error } = useQuery({
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
    if (error) { setEnviandoArquivo(false); return toast.error(erroDeUpload(error, "comunidade")); }
    const { data: pub } = supabase.storage.from("comunidade").getPublicUrl(caminho);
    setArquivo({ url: pub.publicUrl, kind: ehImagem ? "imagem" : "pdf", nome: f.name });
    if (ehImagem) {
      // Pede ao servidor a versão assinada deste MESMO arquivo que acabei de
      // enviar, só para o preview — o bucket privado não deixa o navegador
      // assinar sozinho. Se falhar, ainda publica certo; só o preview
      // imediato fica sem imagem até recarregar.
      try {
        setArquivoPreview((await previaFn({ data: { url: pub.publicUrl } })).url);
      } catch { /* sem preview agora — não impede publicar */ }
    }
    setEnviandoArquivo(false);
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
          poll_options: enquete
            ? opcoesEnquete.map((o) => o.trim()).filter((o) => o.length > 0)
            : undefined,
          evento_id: modoEvento ? eventoEscolhido?.id : undefined,
        },
      }),
    onSuccess: () => {
      setTexto(""); setLink(""); setArquivo(null); setArquivoPreview(null);
      setMencaoAtiva(null);
      setEnquete(false); setOpcoesEnquete(["", ""]);
      setModoEvento(false); setEventoEscolhido(null);
      if (fileRef.current) fileRef.current.value = "";
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const curtir = useMutation({
    mutationFn: (v: { post_id: string; curtir: boolean }) => curtirFn({ data: v }),
    onSuccess: recarregar,
  });
  const votar = useMutation({
    mutationFn: (v: { post_id: string; option_id: string }) => votarFn({ data: v }),
    onSuccess: recarregar,
    onError: (e: Error) => toast.error(e.message),
  });
  const enviarComentario = useMutation({
    mutationFn: (v: { post_id: string; body: string }) => comentarFn({ data: v }),
    onSuccess: (_r, v) => {
      setComentando((c) => ({ ...c, [v.post_id]: "" }));
      setMencaoAtiva(null);
      recarregar();
    },
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

  // Os grupos do campo que tem uma menção em andamento agora — do post
  // (destino escolhido, ou todos os grupos de quem não escolhe) ou do post
  // ao qual o comentário pertence. MESMA regra de visibilidade da aba
  // Membros: quem pode ser marcado é sempre quem está nesses grupos, nunca
  // gente de fora — a busca abaixo usa a mesma função que a aba já usa.
  const groupIdsAtivos = !mencaoAtiva
    ? []
    : mencaoAtiva.tipo === "post"
      ? (escolherDestino ? destino : grupos.map((g) => g.id))
      : (posts.find((p) => p.id === mencaoAtiva.postId)?.group_ids ?? []);

  const { data: membrosData } = useQuery({
    queryKey: ["membros-mencao", groupIdsAtivos.join(",")],
    queryFn: () => membrosFn({ data: { group_ids: groupIdsAtivos } }),
    enabled: !!mencaoAtiva && groupIdsAtivos.length > 0,
  });
  const sugestoes = (membrosData?.membros ?? [])
    .filter((m) => m.nome.toLowerCase().includes((mencaoAtiva?.termo ?? "").toLowerCase()))
    .slice(0, 8);

  function selecionarMencao(m: { person_id: string; nome: string }) {
    if (!mencaoAtiva) return;
    const marcado = `${marcarPessoa(m.nome, m.person_id)} `;
    if (mencaoAtiva.tipo === "post") {
      const fim = mencaoAtiva.inicio + 1 + mencaoAtiva.termo.length;
      const novo = texto.slice(0, mencaoAtiva.inicio) + marcado + texto.slice(fim);
      setTexto(novo);
      // Devolve o foco ao campo, com o cursor logo depois do que inseriu.
      requestAnimationFrame(() => {
        const el = textoRef.current;
        if (!el) return;
        el.focus();
        const pos = mencaoAtiva.inicio + marcado.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      const atual = comentando[mencaoAtiva.postId] ?? "";
      const fim = mencaoAtiva.inicio + 1 + mencaoAtiva.termo.length;
      const novo = atual.slice(0, mencaoAtiva.inicio) + marcado + atual.slice(fim);
      setComentando((c) => ({ ...c, [mencaoAtiva.postId]: novo }));
      requestAnimationFrame(() => {
        const el = comentarioRefs.current[mencaoAtiva.postId];
        if (!el) return;
        el.focus();
        const pos = mencaoAtiva.inicio + marcado.length;
        el.setSelectionRange(pos, pos);
      });
    }
    setMencaoAtiva(null);
  }

  /** As teclas que a listinha de @ entende, comuns ao post e ao comentário. */
  function teclaDaMencao(e: KeyboardEvent, doCampo: boolean): boolean {
    if (!doCampo || sugestoes.length === 0) return false;
    if (e.key === "ArrowDown") { e.preventDefault(); setIndiceSelecionado((i) => (i + 1) % sugestoes.length); return true; }
    if (e.key === "ArrowUp") { e.preventDefault(); setIndiceSelecionado((i) => (i - 1 + sugestoes.length) % sugestoes.length); return true; }
    if (e.key === "Enter") { e.preventDefault(); selecionarMencao(sugestoes[indiceSelecionado] ?? sugestoes[0]); return true; }
    if (e.key === "Escape") { e.preventDefault(); setMencaoAtiva(null); return true; }
    return false;
  }

  function ListaDeMencao({ ativa }: { ativa: boolean }) {
    if (!ativa || sugestoes.length === 0) return null;
    return (
      <div className="relative">
        <div className="absolute z-10 mt-1 max-h-48 w-full min-w-48 overflow-y-auto rounded-lg border border-black/10 bg-popover shadow-md">
          {sugestoes.map((m, i) => (
            <button
              key={m.person_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selecionarMencao(m)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                i === indiceSelecionado && "bg-muted",
              )}
            >
              <Avatar url={m.avatar_url} nome={m.nome} className="size-6" />
              <span className="truncate">{m.nome}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Veio de uma notificação de menção: rola até o post assim que o feed
  // carregar. Se o post não estiver mais na lista (apagado, ou notificação
  // antiga demais para os 80 mais recentes), mostra um aviso educado — nunca
  // uma tela de erro (pedido explícito da #55).
  const [postNaoEncontrado, setPostNaoEncontrado] = useState(false);
  useEffect(() => {
    if (!focoPostId || isLoading) return;
    const existe = posts.some((p) => p.id === focoPostId);
    if (existe) {
      setPostNaoEncontrado(false);
      const el = document.getElementById(`post-${focoPostId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setPostNaoEncontrado(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoPostId, isLoading, posts.length]);

  return (
    // Feed à esquerda, ranking e membros à direita — no celular, um embaixo do
    // outro, com a coluna DEPOIS do feed: quem abre a comunidade no telefone
    // quer ler o que foi publicado, não a tabela de pontos.
    <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
    <div className="space-y-5">
      {/* ------------------------------------------------- escrever --- */}
      {/*
        Na prévia "Ver como aluno" o campo aparece, mas desligado.
        Escondê-lo fazia a prévia mentir: dava a entender que o aluno não pode
        publicar, quando ele pode — e é ele quem escreve. Publicar aqui, por sua
        vez, criaria uma publicação assinada por VOCÊ com a cara dele.
      */}
      {!error && somenteLeitura && (
        <div className="rounded-xl border border-dashed border-black/10 bg-card p-4">
          <div className="pointer-events-none select-none opacity-50">
            <Textarea rows={2} disabled placeholder="Compartilhe algo com o grupo…" />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            <strong>O aluno publica por aqui</strong> — o campo é dele, e ele apaga o que ele mesmo
            publicou. Nesta prévia o campo fica desligado porque a publicação sairia no seu nome,
            não no dele. Para publicar você mesmo, use o menu <strong>Comunidades</strong>.
          </p>
        </div>
      )}
      {!error && !somenteLeitura && (
      <div className="rounded-xl border border-black/5 bg-card p-4">
        <Textarea
          ref={textoRef}
          value={texto}
          onChange={(e) => {
            const valor = e.target.value;
            setTexto(valor);
            const cursor = e.target.selectionStart ?? valor.length;
            const ativa = detectarMencao(valor, cursor);
            setMencaoAtiva(ativa ? { tipo: "post", ...ativa } : null);
            setIndiceSelecionado(0);
          }}
          onKeyDown={(e) => teclaDaMencao(e, mencaoAtiva?.tipo === "post")}
          onBlur={() => setTimeout(() => setMencaoAtiva((m) => (m?.tipo === "post" ? null : m)), 150)}
          rows={3}
          placeholder="Compartilhe algo com o grupo… use @ para marcar alguém"
        />
        <ListaDeMencao ativa={mencaoAtiva?.tipo === "post"} />
        {/* Enquete (#54): a pergunta é o texto acima — aqui só as opções. */}
        {enquete && (
          <div className="mt-3 space-y-2 rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              A enquete usa o que você escreveu acima como pergunta. Adicione de 2 a 6 opções.
            </p>
            {opcoesEnquete.map((op, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={op}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOpcoesEnquete((prev) => prev.map((x, j) => (j === i ? v : x)));
                  }}
                  placeholder={`Opção ${i + 1}`}
                  maxLength={200}
                />
                {opcoesEnquete.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOpcoesEnquete((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {opcoesEnquete.length < 6 && (
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setOpcoesEnquete((prev) => [...prev, ""])}
              >
                + Opção
              </Button>
            )}
          </div>
        )}
        {/* Evento como cartão (#56): escolher preenche o texto com o título —
            a pergunta do requisito "referencia, não copia" é sobre o CARTÃO no
            feed, que sempre lê o evento ao vivo; isto aqui é só o rascunho. */}
        {modoEvento && (
          <div className="mt-3 space-y-2 rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Escolha um evento já cadastrado na Agenda para publicar como cartão.
            </p>
            {eventoEscolhido && (
              <div className="flex items-center gap-2 rounded-lg border border-primary bg-card p-2 text-sm">
                <CalendarDays className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium">{eventoEscolhido.titulo}</span>
                <button type="button" onClick={() => setEventoEscolhido(null)} className="text-muted-foreground hover:text-destructive">
                  <X className="size-4" />
                </button>
              </div>
            )}
            {!eventoEscolhido && (
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {(eventosData?.eventos ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum evento cadastrado na Agenda ainda.</p>
                )}
                {(eventosData?.eventos ?? []).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => { setEventoEscolhido({ id: ev.id, titulo: ev.titulo }); setTexto(ev.titulo); }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-black/10 p-2 text-left text-sm hover:bg-muted/50"
                  >
                    <span className="min-w-0 truncate">{ev.titulo}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{dataDoEvento(ev.quando)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {arquivo && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
            {arquivo.kind === "imagem"
              ? <img src={arquivoPreview ?? arquivo.url} alt="" className="size-10 rounded object-cover" />
              : <FileText className="size-5 text-muted-foreground" />}
            <span className="min-w-0 flex-1 truncate">{arquivo.nome}</span>
            <button onClick={() => { setArquivo(null); setArquivoPreview(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        )}
        <Input
          value={link} onChange={(e) => setLink(e.target.value)}
          placeholder="Link (opcional)" className="mt-3"
        />
        <input
          ref={fileRef} type="file" accept={ACCEPT.comunidade} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void escolherArquivo(f); }}
        />
        {escolherDestino && (
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">
              Publicar em {destino.length === 0 && <span className="text-destructive">— escolha ao menos um grupo</span>}
            </p>
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
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={enviandoArquivo}>
              <Paperclip className="size-3.5" /> {enviandoArquivo ? "Enviando…" : "Imagem ou PDF"}
            </Button>
            <Button
              variant={enquete ? "secondary" : "ghost"} size="sm"
              onClick={() => setEnquete((v) => {
                // Mutuamente exclusivo com Evento (#56) — os dois ao mesmo
                // tempo não fazem sentido no mesmo post.
                if (!v) { setModoEvento(false); setEventoEscolhido(null); }
                return !v;
              })}
            >
              <BarChart3 className="size-3.5" /> Enquete
            </Button>
            <Button
              variant={modoEvento ? "secondary" : "ghost"} size="sm"
              onClick={() => setModoEvento((v) => {
                if (!v) { setEnquete(false); setOpcoesEnquete(["", ""]); }
                else setEventoEscolhido(null);
                return !v;
              })}
            >
              <CalendarDays className="size-3.5" /> Evento
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => publicar.mutate()}
            disabled={
              publicar.isPending
              || texto.trim().length === 0
              || (escolherDestino ? destino.length === 0 : grupos.length === 0)
              || (enquete && opcoesEnquete.filter((o) => o.trim().length > 0).length < 2)
              || (modoEvento && !eventoEscolhido)
            }
          >
            <Send className="size-3.5" /> {publicar.isPending ? "Publicando…" : "Publicar"}
          </Button>
        </div>
      </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {error && (
        <div className="rounded-xl bg-destructive/10 p-8 text-center">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        </div>
      )}

      {!isLoading && !error && posts.length === 0 && (
        <p className="rounded-xl bg-muted/40 p-6 text-sm text-muted-foreground">
          Ninguém publicou nada ainda. A primeira publicação costuma ser a mais difícil — e é a que
          faz o resto do grupo começar.
        </p>
      )}

      {/* Veio de uma notificação de menção, mas o post não está mais aqui —
          apagado, ou fora da janela dos 80 mais recentes. Nunca é erro. */}
      {postNaoEncontrado && (
        <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
          A publicação que você estava procurando não está mais disponível.
        </p>
      )}

      {/* ---------------------------------------------------- feed --- */}
      {!error && posts.map((p) => (
        <article
          key={p.id}
          id={`post-${p.id}`}
          className={cn(
            "rounded-xl border border-black/5 bg-card p-4 transition-shadow",
            focoPostId === p.id && "ring-2 ring-primary/50",
          )}
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{p.author_name}</p>
              {grupos.length > 1 && p.grupos.length > 0 && (
                <p className="truncate text-xs text-muted-foreground">{p.grupos.join(" · ")}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{quando(p.created_at)}</span>
              {(p.meu || p.modero) && (
                <button
                  onClick={() => bloqueadoNoPreview(somenteLeitura, () => apagar.mutate(p.id))}
                  className="text-muted-foreground hover:text-destructive"
                  title={p.meu ? "Apagar minha publicação" : "Remover do grupo"}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {renderTextoComMencoes(p.body, setVendoPerfil)}
          </p>

          {/* Enquete (#54): a pergunta é o texto acima; aqui só as opções. */}
          {p.enquete && (
            <div className="mt-3 space-y-2">
              {!p.enquete.meuVoto && (
                <p className="text-xs text-muted-foreground">
                  {p.enquete.totalVotos === 0 && "Seja o primeiro a votar. "}
                  Os votos ficam visíveis para o grupo depois que você votar.
                </p>
              )}
              {p.enquete.meuVoto
                ? p.enquete.opcoes.map((o) => {
                    const r = p.enquete!.resultado!.find((x) => x.id === o.id);
                    if (!r) return null;
                    const escolhida = o.id === p.enquete!.meuVoto;
                    return (
                      <div key={o.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => bloqueadoNoPreview(somenteLeitura, () => votar.mutate({ post_id: p.id, option_id: o.id }))}
                            className={cn(
                              "relative flex-1 overflow-hidden rounded-lg border p-2 text-left text-sm transition",
                              escolhida ? "border-primary" : "border-black/10 hover:border-black/20",
                            )}
                          >
                            <div
                              className="absolute inset-y-0 left-0 bg-primary/10"
                              style={{ width: `${r.porcentagem}%` }}
                            />
                            <div className="relative flex items-center justify-between gap-2">
                              <span className={cn(escolhida && "font-medium")}>{o.texto}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{r.porcentagem}%</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setVerVotantes((v) => (v === o.id ? null : o.id))}
                            title="Ver quem votou"
                            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {r.contagem}
                          </button>
                        </div>
                        {verVotantes === o.id && (
                          <p className="pl-2 text-xs text-muted-foreground">
                            {r.votantes.length > 0 ? r.votantes.join(", ") : "Ninguém votou nesta opção ainda."}
                          </p>
                        )}
                      </div>
                    );
                  })
                : p.enquete.opcoes.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => bloqueadoNoPreview(somenteLeitura, () => votar.mutate({ post_id: p.id, option_id: o.id }))}
                      className="w-full rounded-lg border border-black/10 p-2 text-left text-sm hover:bg-muted/50"
                    >
                      {o.texto}
                    </button>
                  ))}
            </div>
          )}

          {/* Cartão de evento (#56) — referencia o evento, nunca copia: os
              dados abaixo vêm ao vivo de `eventos` a cada carregamento do
              feed. Mudou a data na Agenda, o cartão muda sozinho. */}
          {p.evento && p.evento.apagado && (
            <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              Este evento não está mais disponível.
            </p>
          )}
          {p.evento && !p.evento.apagado && (
            <div className="mt-3 overflow-hidden rounded-lg border border-black/10">
              {p.evento.imagemUrl && (
                <img src={p.evento.imagemUrl} alt="" className="max-h-48 w-full object-cover" />
              )}
              <div className="space-y-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-medium">{p.evento.titulo}</p>
                  {p.evento.jaAconteceu && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      já aconteceu
                    </span>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {dataDoEvento(p.evento.quando)}
                  {p.evento.terminaEm && ` até ${dataDoEvento(p.evento.terminaEm)}`}
                </p>
                {p.evento.linkUrl && (
                  <a
                    href={p.evento.linkUrl} target="_blank" rel="noreferrer"
                    className="block truncate text-xs text-primary hover:underline"
                  >
                    {p.evento.linkUrl}
                  </a>
                )}
                <a href={linkAgenda} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                  Ver na Agenda →
                </a>
              </div>
            </div>
          )}

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
              onClick={() => bloqueadoNoPreview(somenteLeitura, () => curtir.mutate({ post_id: p.id, curtir: !p.curti }))}
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
                      {(c.meu || p.modero) && (
                        <button
                          onClick={() => bloqueadoNoPreview(somenteLeitura, () => apagarCom.mutate(c.id))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">
                    {renderTextoComMencoes(c.body, setVendoPerfil)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <Input
                ref={(el) => { comentarioRefs.current[p.id] = el; }}
                value={comentando[p.id] ?? ""}
                onChange={(e) => {
                  const valor = e.target.value;
                  setComentando((c) => ({ ...c, [p.id]: valor }));
                  const cursor = e.target.selectionStart ?? valor.length;
                  const ativa = detectarMencao(valor, cursor);
                  setMencaoAtiva(ativa ? { tipo: "comentario", postId: p.id, ...ativa } : null);
                  setIndiceSelecionado(0);
                }}
                placeholder="Escreva um comentário… use @ para marcar alguém"
                onKeyDown={(e) => {
                  const doCampo = mencaoAtiva?.tipo === "comentario" && mencaoAtiva.postId === p.id;
                  if (teclaDaMencao(e, doCampo)) return;
                  if (e.key === "Enter" && (comentando[p.id] ?? "").trim()) {
                    bloqueadoNoPreview(somenteLeitura, () => enviarComentario.mutate({ post_id: p.id, body: comentando[p.id] }));
                  }
                }}
                onBlur={() => setTimeout(
                  () => setMencaoAtiva((m) => (m?.tipo === "comentario" && m.postId === p.id ? null : m)),
                  150,
                )}
              />
              <ListaDeMencao ativa={mencaoAtiva?.tipo === "comentario" && mencaoAtiva.postId === p.id} />
            </div>
            <Button
              size="sm" variant="outline"
              disabled={!(comentando[p.id] ?? "").trim()}
              onClick={() => bloqueadoNoPreview(somenteLeitura, () => enviarComentario.mutate({ post_id: p.id, body: comentando[p.id] }))}
            >
              Enviar
            </Button>
          </div>
        </article>
      ))}
    </div>
      <LadoDaComunidade grupos={grupos} />
      <PerfilColegaDialog personId={vendoPerfil} onOpenChange={(v) => !v && setVendoPerfil(null)} />
    </div>
  );
}
