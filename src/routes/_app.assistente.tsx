/**
 * ASSISTENTE DO PAINEL (#307) — o dono da conta conversa sobre os resultados e o uso da plataforma dos
 * alunos DELE. Outra assistente, com outras conversas: a do aluno mora em /aluno/assistente e nada
 * daqui encosta nela.
 *
 * Nada aqui decide o que o mentor pode ver: quem decide é o banco (o portão
 * `assistente_mentor_liberada` e a RLS de cada tabela, lida com o login dele) e as funções do servidor.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  abrirConversaDoMentor, apagarConversaDoMentor, apagarTodasAsConversasDoMentor, carregarAssistenteDoMentor,
  enviarMensagemDoMentor, type ConversaDoMentor, type MensagemDoMentor,
} from "@/lib/assistente-mentor.functions";
import { ASSISTENTE_DO_MENTOR as TXT } from "@/lib/assistente-mentor/textos";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { MessageSquarePlus, PanelLeft, Send, Sparkles, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/assistente")({
  head: () => ({ meta: [{ title: "Assistente — Métrica Humana" }] }),
  component: PaginaDaAssistenteDoMentor,
});

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="size-5 text-primary" /> {TXT.titulo}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{TXT.subtitulo}</p>
      </div>
      {children}
    </div>
  );
}

function PaginaDaAssistenteDoMentor() {
  const carregarFn = useServerFn(carregarAssistenteDoMentor);
  const { data, isLoading, error } = useQuery({
    queryKey: ["assistente-mentor"],
    queryFn: () => carregarFn(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Moldura>
        <Skeleton className="h-64 w-full rounded-xl" />
      </Moldura>
    );
  }
  if (error || !data) {
    return (
      <Moldura>
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Não foi possível abrir a assistente."}</p>
      </Moldura>
    );
  }
  if (!data.liberada) {
    return (
      <Moldura>
        <div className="rounded-xl bg-card p-8 text-sm text-muted-foreground ring-1 ring-black/5">{TXT.indisponivel}</div>
      </Moldura>
    );
  }
  return (
    <Moldura>
      <Conversas conversas={data.conversas} />
    </Moldura>
  );
}

// ------------------------------------------------------------------------------------------------
// Texto das mensagens: só **negrito**, parágrafos e listas com hífen. Nada de HTML vindo de fora.
// ------------------------------------------------------------------------------------------------

function comNegrito(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith("**") && parte.endsWith("**") ? <strong key={i}>{parte.slice(2, -2)}</strong> : <span key={i}>{parte}</span>,
  );
}

/** Um bloco pode misturar frase e itens ("Estes são:\n- A\n- B"): cada trecho vira o que ele é. */
function trechosDoBloco(bloco: string): Array<{ lista: boolean; linhas: string[] }> {
  const trechos: Array<{ lista: boolean; linhas: string[] }> = [];
  for (const linha of bloco.split("\n")) {
    const item = /^\s*[-•]\s+/.test(linha);
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.lista === item) ultimo.linhas.push(item ? linha.replace(/^\s*[-•]\s+/, "") : linha);
    else trechos.push({ lista: item, linhas: [item ? linha.replace(/^\s*[-•]\s+/, "") : linha] });
  }
  return trechos;
}

function TextoDaMensagem({ texto }: { texto: string }) {
  return (
    <div className="space-y-2">
      {texto.split(/\n{2,}/).flatMap((bloco, i) =>
        trechosDoBloco(bloco).map((t, k) =>
          t.lista ? (
            <ul key={`${i}-${k}`} className="list-disc space-y-1 pl-5">
              {t.linhas.map((l, j) => <li key={j}>{comNegrito(l)}</li>)}
            </ul>
          ) : (
            <p key={`${i}-${k}`}>
              {t.linhas.map((l, j) => (
                <span key={j}>{j > 0 && <br />}{comNegrito(l)}</span>
              ))}
            </p>
          ),
        ),
      )}
    </div>
  );
}

function Balao({ m }: { m: Pick<MensagemDoMentor, "papel" | "conteudo"> }) {
  const doMentor = m.papel === "mentor";
  return (
    <div className={cn("flex", doMentor ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[80%]",
          doMentor ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        <TextoDaMensagem texto={m.conteudo} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Conversas.
// ------------------------------------------------------------------------------------------------

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function ListaDeConversas({
  conversas, ativa, onEscolher, onNova,
}: { conversas: ConversaDoMentor[]; ativa: string | null; onEscolher: (id: string) => void; onNova: () => void }) {
  const qc = useQueryClient();
  const apagarFn = useServerFn(apagarConversaDoMentor);
  const apagarTudoFn = useServerFn(apagarTodasAsConversasDoMentor);
  const apagar = useMutation({
    mutationFn: (id: string) => apagarFn({ data: { conversa_id: id } }),
    onSuccess: (_d, id) => {
      if (id === ativa) onNova();
      void qc.invalidateQueries({ queryKey: ["assistente-mentor"] });
      toast.success("Conversa apagada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível apagar."),
  });
  const apagarTudo = useMutation({
    mutationFn: () => apagarTudoFn(),
    onSuccess: () => {
      onNova();
      qc.removeQueries({ queryKey: ["assistente-mentor-conversa"] });
      void qc.invalidateQueries({ queryKey: ["assistente-mentor"] });
      toast.success("Conversas apagadas.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível apagar."),
  });
  return (
    <div className="flex h-full flex-col">
      <Button variant="outline" className="w-full justify-start gap-2" onClick={onNova}>
        <MessageSquarePlus className="size-4" /> {TXT.novaConversa}
      </Button>
      <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
        {conversas.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">{TXT.semConversas}</p>}
        {conversas.map((c) => (
          <div
            key={c.id}
            className={cn("group flex items-center gap-1 rounded-md pr-1", c.id === ativa ? "bg-muted" : "hover:bg-muted/60")}
          >
            <button className="min-w-0 flex-1 px-2.5 py-2 text-left" onClick={() => onEscolher(c.id)}>
              <p className="truncate text-sm">{c.titulo}</p>
              <p className="text-[11px] text-muted-foreground">{dataCurta(c.atualizada_em)}</p>
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-destructive" title="Apagar conversa">
                  <Trash2 className="size-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar esta conversa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{c.titulo}" some do seu histórico e não volta. As outras conversas continuam.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => apagar.mutate(c.id)}>Apagar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>
      {conversas.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="mt-2 px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-destructive">{TXT.apagarTudo}</button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{TXT.apagarTudo}?</AlertDialogTitle>
              <AlertDialogDescription>{TXT.apagarTudoConfirma}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => apagarTudo.mutate()}>Apagar tudo</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function Conversas({ conversas }: { conversas: ConversaDoMentor[] }) {
  const qc = useQueryClient();
  const [ativa, setAtiva] = useState<string | null>(null);
  const [locais, setLocais] = useState<Pick<MensagemDoMentor, "papel" | "conteudo">[]>([]);
  const [texto, setTexto] = useState("");
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const abrirFn = useServerFn(abrirConversaDoMentor);
  const { data: carregadas, isFetching } = useQuery({
    queryKey: ["assistente-mentor-conversa", ativa],
    queryFn: () => abrirFn({ data: { conversa_id: ativa! } }),
    enabled: !!ativa,
  });

  const enviarFn = useServerFn(enviarMensagemDoMentor);
  const enviar = useMutation({
    mutationFn: (pergunta: string) => enviarFn({ data: { conversa_id: ativa, texto: pergunta } }),
    onMutate: (pergunta) => {
      setLocais((l) => [...l, { papel: "mentor", conteudo: pergunta }]);
      setTexto("");
    },
    onSuccess: (r) => {
      qc.setQueryData(["assistente-mentor-conversa", r.conversa_id], (antes: MensagemDoMentor[] | undefined) => [
        ...(antes ?? []),
        ...r.mensagens,
      ]);
      setLocais([]);
      setAtiva(r.conversa_id);
      void qc.invalidateQueries({ queryKey: ["assistente-mentor"] });
    },
    onError: (e, pergunta) => {
      // A pergunta não ficou guardada: volta para a caixa, para tentar de novo sem redigitar.
      setLocais([]);
      setTexto(pergunta);
      toast.error(e instanceof Error ? e.message : "A assistente não conseguiu responder agora.");
    },
  });

  const mensagens = useMemo(() => [...(ativa ? (carregadas ?? []) : []), ...locais], [ativa, carregadas, locais]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens.length, enviar.isPending]);

  function mandar(pergunta: string) {
    const limpo = pergunta.trim();
    if (!limpo || enviar.isPending) return;
    enviar.mutate(limpo);
  }

  function novaConversa() {
    setAtiva(null);
    setLocais([]);
    setGavetaAberta(false);
  }

  const lista = (
    <ListaDeConversas
      conversas={conversas}
      ativa={ativa}
      onEscolher={(id) => { setAtiva(id); setLocais([]); setGavetaAberta(false); }}
      onNova={novaConversa}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[28rem] gap-4">
      {/* Lista de conversas: coluna no computador, gaveta no celular. */}
      <aside className="hidden w-60 shrink-0 rounded-xl bg-card p-3 ring-1 ring-black/5 lg:block">{lista}</aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-xl bg-card ring-1 ring-black/5">
        <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
          <Sheet open={gavetaAberta} onOpenChange={setGavetaAberta}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 lg:hidden">
                <PanelLeft className="size-4" /> Conversas
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader className="p-0 pb-3">
                <SheetTitle>Conversas</SheetTitle>
              </SheetHeader>
              <div className="h-[calc(100%-3rem)]">{lista}</div>
            </SheetContent>
          </Sheet>
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {ativa ? conversas.find((c) => c.id === ativa)?.titulo ?? "" : TXT.novaConversa}
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5">
          {ativa && isFetching && mensagens.length === 0 ? (
            <Skeleton className="h-20 w-2/3 rounded-2xl" />
          ) : (
            <>
              {mensagens.length === 0 && (
                <>
                  <Balao m={{ papel: "assistente", conteudo: TXT.abertura }} />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {TXT.sugestoes.map((s) => (
                      <button
                        key={s}
                        onClick={() => mandar(s)}
                        className="rounded-full border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {mensagens.map((m, i) => <Balao key={i} m={m} />)}
              {enviar.isPending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                    <span className="animate-pulse">{TXT.pensando}</span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={fim} />
        </div>

        <div className="border-t border-black/5 p-3">
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); mandar(texto); }}>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                // Enter envia, Shift+Enter quebra linha. No celular o teclado não tem Shift: o botão manda.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  mandar(texto);
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder={TXT.placeholder}
              className="max-h-40 min-h-10 resize-none text-base sm:text-sm"
              disabled={enviar.isPending}
            />
            <Button type="submit" size="icon" disabled={!texto.trim() || enviar.isPending} title="Enviar">
              <Send className="size-4" />
            </Button>
          </form>
          <p className="mt-2 text-[11px] text-muted-foreground">{TXT.rodape}</p>
        </div>
      </section>
    </div>
  );
}
