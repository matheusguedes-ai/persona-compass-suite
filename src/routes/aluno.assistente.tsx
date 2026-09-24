/**
 * ASSISTENTE DO MÉTODO INTENÇÃO — Nível 1 (#289). O aluno conversa sobre o PRÓPRIO relatório.
 *
 * Três estados: (1) prévia do mentor → aviso, nada de conversa (a prévia roda com o login do mentor,
 * e a conversa é espaço privado do aluno); (2) ainda sem autorização → o termo inteiro na tela, caixa
 * de aceite desmarcada; (3) autorizado → conversas, histórico, cópia para baixar e revogação.
 *
 * Nada aqui decide o que a pessoa pode ver: quem decide é o banco (RLS) e as funções do servidor.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  abrirConversa, aceitarTermo, apagarConversa, apagarTodasAsConversas, carregarAssistente,
  enviarMensagem, meusDadosDaAssistente, revogarAssistente, type ConversaResumo, type Mensagem,
} from "@/lib/assistente.functions";
import { ASSISTENTE } from "@/lib/assistente/textos";
import { lerPreviewSalvo } from "@/lib/preview-mode";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Download, Lock, MessageSquarePlus, PanelLeft, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

export const Route = createFileRoute("/aluno/assistente")({
  validateSearch: (s: Record<string, unknown>) => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
  }),
  head: () => ({ meta: [{ title: "Assistente" }, { name: "robots", content: "noindex" }] }),
  component: PaginaDaAssistente,
});

function PaginaDaAssistente() {
  const { ver } = Route.useSearch();
  // A prévia "ver como aluno" roda com o login do MENTOR: aqui ela não mostra nada, nunca.
  if (ver ?? lerPreviewSalvo()) {
    return (
      <Moldura>
        <div className="rounded-xl border border-dashed border-black/10 bg-card p-10 text-center ring-1 ring-black/5">
          <Lock className="mx-auto size-7 text-muted-foreground" />
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{ASSISTENTE.previa}</p>
        </div>
      </Moldura>
    );
  }
  return <AssistenteDoAluno />;
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-2 sm:mx-0">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="size-5 text-primary" />
        <h1 className="text-lg font-semibold">{ASSISTENTE.nome}</h1>
      </div>
      {children}
    </div>
  );
}

function AssistenteDoAluno() {
  const carregarFn = useServerFn(carregarAssistente);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["assistente"],
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
  if (!data.consentimento) {
    return (
      <Moldura>
        {data.termo ? (
          <TermoDeConsentimento termo={data.termo} onAceito={() => void refetch()} />
        ) : (
          <div className="rounded-xl bg-card p-8 text-sm text-muted-foreground ring-1 ring-black/5">
            {ASSISTENTE.indisponivel}
          </div>
        )}
      </Moldura>
    );
  }
  return (
    <Moldura>
      <Conversas
        conversas={data.conversas}
        consentimento={data.consentimento}
        podeEnviar={data.situacao.liberada && data.situacao.tem_relatorio}
      />
    </Moldura>
  );
}

// ------------------------------------------------------------------------------------------------
// O termo: inteiro na tela, legível, antes de qualquer aceite. A caixa nasce DESMARCADA.
// ------------------------------------------------------------------------------------------------

function TextoDoTermo({ texto }: { texto: string }) {
  const blocos = texto.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
      {blocos.map((b, i) =>
        b.startsWith("### ") ? (
          <h3 key={i} className="pt-2 text-sm font-semibold text-foreground">{b.slice(4)}</h3>
        ) : (
          <p key={i}>{b}</p>
        ),
      )}
    </div>
  );
}

function TermoDeConsentimento({
  termo, onAceito,
}: { termo: { id: string; versao: number; texto: string; rotulo_aceite: string }; onAceito: () => void }) {
  const [marcado, setMarcado] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const aceitarFn = useServerFn(aceitarTermo);
  const aceitar = useMutation({
    mutationFn: () => aceitarFn({ data: { termo_id: termo.id, aceito: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assistente-situacao"] });
      onAceito();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível registrar a autorização."),
  });
  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-black/5 sm:p-8">
      <h2 className="text-base font-semibold">{ASSISTENTE.tituloTermo}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{ASSISTENTE.introTermo}</p>
      <div className="mt-5 border-t border-black/5 pt-4">
        <TextoDoTermo texto={termo.texto} />
      </div>
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-input p-4">
        <Checkbox checked={marcado} onCheckedChange={(v) => setMarcado(v === true)} className="mt-0.5" />
        <span className="text-sm font-medium">{termo.rotulo_aceite}</span>
      </label>
      <p className="mt-2 text-xs text-muted-foreground">Versão {termo.versao} do termo.</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => navigate({ to: "/aluno", search: { ver: undefined } })}>{ASSISTENTE.agoraNao}</Button>
        <Button disabled={!marcado || aceitar.isPending} onClick={() => aceitar.mutate()}>
          {aceitar.isPending ? "Registrando…" : ASSISTENTE.aceitar}
        </Button>
      </div>
    </div>
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

/** Um bloco pode misturar frase e itens ("As forças são:\n- A\n- B"): cada trecho vira o que ele é. */
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

function Balao({ m }: { m: Pick<Mensagem, "papel" | "conteudo"> }) {
  const aluno = m.papel === "aluno";
  return (
    <div className={cn("flex", aluno ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[80%]",
          aluno ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground",
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
}: { conversas: ConversaResumo[]; ativa: string | null; onEscolher: (id: string) => void; onNova: () => void }) {
  const qc = useQueryClient();
  const apagarFn = useServerFn(apagarConversa);
  const apagar = useMutation({
    mutationFn: (id: string) => apagarFn({ data: { conversa_id: id } }),
    onSuccess: (_d, id) => {
      if (id === ativa) onNova();
      void qc.invalidateQueries({ queryKey: ["assistente"] });
      toast.success("Conversa apagada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível apagar."),
  });
  return (
    <div className="flex h-full flex-col">
      <Button variant="outline" className="w-full justify-start gap-2" onClick={onNova}>
        <MessageSquarePlus className="size-4" /> {ASSISTENTE.novaConversa}
      </Button>
      <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
        {conversas.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">{ASSISTENTE.semConversas}</p>}
        {conversas.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex items-center gap-1 rounded-md pr-1",
              c.id === ativa ? "bg-muted" : "hover:bg-muted/60",
            )}
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
    </div>
  );
}

function Conversas({
  conversas, consentimento, podeEnviar,
}: {
  conversas: ConversaResumo[];
  consentimento: { termo_versao: number; aceito_em: string };
  podeEnviar: boolean;
}) {
  const qc = useQueryClient();
  const [ativa, setAtiva] = useState<string | null>(null);
  const [locais, setLocais] = useState<Pick<Mensagem, "papel" | "conteudo">[]>([]);
  const [texto, setTexto] = useState("");
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const abrirFn = useServerFn(abrirConversa);
  const { data: carregadas, isFetching } = useQuery({
    queryKey: ["assistente-conversa", ativa],
    queryFn: () => abrirFn({ data: { conversa_id: ativa! } }),
    enabled: !!ativa,
  });

  const enviarFn = useServerFn(enviarMensagem);
  const enviar = useMutation({
    mutationFn: (pergunta: string) => enviarFn({ data: { conversa_id: ativa, texto: pergunta } }),
    onMutate: (pergunta) => {
      setLocais((l) => [...l, { papel: "aluno", conteudo: pergunta }]);
      setTexto("");
    },
    onSuccess: (r) => {
      qc.setQueryData(["assistente-conversa", r.conversa_id], (antes: Mensagem[] | undefined) => [
        ...(antes ?? []),
        ...r.mensagens,
      ]);
      setLocais([]);
      setAtiva(r.conversa_id);
      void qc.invalidateQueries({ queryKey: ["assistente"] });
    },
    onError: (e, pergunta) => {
      // A pergunta não ficou guardada: volta para a caixa, para tentar de novo sem redigitar.
      setLocais([]);
      setTexto(pergunta);
      toast.error(e instanceof Error ? e.message : "A assistente não conseguiu responder agora.");
    },
  });

  const mensagens = useMemo(
    () => [...(ativa ? (carregadas ?? []) : []), ...locais],
    [ativa, carregadas, locais],
  );

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
    <div className="flex h-[calc(100dvh-11rem)] min-h-[28rem] gap-4 sm:h-[calc(100dvh-13rem)]">
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
            {ativa ? conversas.find((c) => c.id === ativa)?.titulo ?? "" : ASSISTENTE.novaConversa}
          </p>
          <MeusDados consentimento={consentimento} />
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5">
          {ativa && isFetching && mensagens.length === 0 ? (
            <Skeleton className="h-20 w-2/3 rounded-2xl" />
          ) : (
            <>
              {mensagens.length === 0 && (
                <>
                  <Balao m={{ papel: "assistente", conteudo: ASSISTENTE.abertura }} />
                  {podeEnviar && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {ASSISTENTE.sugestoes.map((s) => (
                        <button
                          key={s}
                          onClick={() => mandar(s)}
                          className="rounded-full border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {mensagens.map((m, i) => <Balao key={i} m={m} />)}
              {enviar.isPending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                    <span className="animate-pulse">{ASSISTENTE.pensando}</span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={fim} />
        </div>

        <div className="border-t border-black/5 p-3">
          {podeEnviar ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => { e.preventDefault(); mandar(texto); }}
            >
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
                placeholder={ASSISTENTE.placeholder}
                className="max-h-40 min-h-10 resize-none text-base sm:text-sm"
                disabled={enviar.isPending}
              />
              <Button type="submit" size="icon" disabled={!texto.trim() || enviar.isPending} title="Enviar">
                <Send className="size-4" />
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">{ASSISTENTE.indisponivel}</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">{ASSISTENTE.rodape}</p>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// "O que fica guardado": ver, baixar uma cópia, apagar tudo e retirar a autorização.
// ------------------------------------------------------------------------------------------------

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function MeusDados({ consentimento }: { consentimento: { termo_versao: number; aceito_em: string } }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const dadosFn = useServerFn(meusDadosDaAssistente);
  const apagarTudoFn = useServerFn(apagarTodasAsConversas);
  const revogarFn = useServerFn(revogarAssistente);

  const baixar = useMutation({
    mutationFn: () => dadosFn(),
    onSuccess: (d) => {
      const linhas: string[] = [
        "ASSISTENTE DO MÉTODO INTENÇÃO — CÓPIA DOS SEUS DADOS",
        `Gerada em ${dataHora(new Date().toISOString())}`,
        "",
        "AUTORIZAÇÕES",
        ...d.consentimentos.map(
          (c) =>
            `- Termo versão ${c.termo_versao}, aceito em ${dataHora(c.aceito_em)}` +
            (c.revogado_em ? `, retirado em ${dataHora(c.revogado_em)}` : " (em vigor)"),
        ),
        "",
        `CONVERSAS (${d.conversas.length})`,
      ];
      for (const c of d.conversas) {
        linhas.push("", `=== ${c.titulo} (começou em ${dataHora(c.criada_em)})`);
        for (const m of c.mensagens) {
          linhas.push("", `[${dataHora(m.criada_em)}] ${m.papel === "aluno" ? "Você" : "Assistente"}:`, m.conteudo);
        }
      }
      const vigente = d.consentimentos[d.consentimentos.length - 1];
      if (vigente) {
        linhas.push("", `TEXTO DO TERMO QUE VOCÊ ACEITOU (versão ${vigente.termo_versao})`, "", vigente.texto_aceito.replace(/^### /gm, ""), "", `[x] ${vigente.rotulo_aceito}`);
      }
      const blob = new Blob([linhas.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `assistente-metodo-intencao-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível gerar a cópia."),
  });

  const apagarTudo = useMutation({
    mutationFn: () => apagarTudoFn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assistente"] });
      qc.removeQueries({ queryKey: ["assistente-conversa"] });
      setAberto(false);
      toast.success("Todas as conversas foram apagadas.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível apagar."),
  });

  const revogar = useMutation({
    mutationFn: () => revogarFn(),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["assistente-conversa"] });
      void qc.invalidateQueries({ queryKey: ["assistente"] });
      void qc.invalidateQueries({ queryKey: ["assistente-situacao"] });
      setAberto(false);
      toast.success(ASSISTENTE.revogadoAviso);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível retirar a autorização."),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <ShieldCheck className="size-4" /> <span className="hidden sm:inline">{ASSISTENTE.meusDados}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ASSISTENTE.meusDados}</DialogTitle>
          <DialogDescription>
            Você autorizou a assistente em {dataHora(consentimento.aceito_em)} (termo versão {consentimento.termo_versao}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Fica guardado: a data e o texto do termo que você aceitou, e as suas conversas — só você vê. O seu mentor não
            lê nenhuma delas.
          </p>
          <p>
            Para medir o custo da plataforma, cada resposta também registra números de uso (o tamanho da pergunta e da
            resposta), sem nenhum texto seu.
          </p>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <Button variant="outline" className="justify-start gap-2" disabled={baixar.isPending} onClick={() => baixar.mutate()}>
            <Download className="size-4" /> {baixar.isPending ? "Preparando…" : "Baixar uma cópia de tudo"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="justify-start gap-2">
                <Trash2 className="size-4" /> Apagar todas as conversas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todas as conversas?</AlertDialogTitle>
                <AlertDialogDescription>
                  O seu histórico inteiro some e não volta. A autorização continua valendo: você pode seguir usando a
                  assistente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => apagarTudo.mutate()}>Apagar tudo</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="justify-start gap-2 text-destructive hover:text-destructive">
                <Lock className="size-4" /> Retirar a autorização
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Retirar a autorização?</AlertDialogTitle>
                <AlertDialogDescription>
                  A assistente para de acessar os seus dados e todo o seu histórico de conversas é apagado — isso não
                  volta. Se quiser usar de novo depois, é só ler e aceitar o termo outra vez.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => revogar.mutate()}>Retirar autorização</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
