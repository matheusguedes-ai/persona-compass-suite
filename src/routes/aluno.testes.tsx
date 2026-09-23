import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getMeusTestesLiberados, iniciarOuRetomarTeste, cancelarMinhaTentativa,
  type TentativaDoAluno, type TesteLiberado,
} from "@/lib/student.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FlaskConical, Clock, CheckCircle2, RotateCcw, MailQuestion } from "lucide-react";

export const Route = createFileRoute("/aluno/testes")({
  validateSearch: (s: Record<string, unknown>) => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
  }),
  head: () => ({ meta: [{ title: "Testes" }, { name: "robots", content: "noindex" }] }),
  component: TestesDoAluno,
});

/**
 * O que a tela precisa saber sobre um instrumento, a partir das tentativas
 * (da mais recente para a mais antiga — é assim que o servidor já devolve).
 *
 * "Vigente" segue a regra do dono (#298): entre as CONCLUÍDAS, é sempre a
 * mais recente — nunca a `tentativas[0]` sem checar, porque a mais recente de
 * todas pode ser uma tentativa aberta mais nova que a última concluída.
 */
function resumo(tentativas: TentativaDoAluno[]) {
  const aberta = tentativas.find((t) => !t.submitted_at && !t.canceled_at) ?? null;
  const vigente = tentativas.find((t) => t.submitted_at) ?? null;
  const totalConcluidas = tentativas.filter((t) => t.submitted_at).length;
  return { aberta, vigente, totalConcluidas };
}

function TestesDoAluno() {
  const { ver } = Route.useSearch();
  const qc = useQueryClient();
  const listarFn = useServerFn(getMeusTestesLiberados);
  const iniciarFn = useServerFn(iniciarOuRetomarTeste);
  const cancelarFn = useServerFn(cancelarMinhaTentativa);

  const { data, isLoading } = useQuery({
    queryKey: ["meus-testes-liberados", ver ?? null],
    queryFn: () => listarFn({ data: { preview_person_id: ver ?? null } }),
  });

  const [carregando, setCarregando] = useState<string | null>(null);

  const abrirTeste = async (item: TesteLiberado) => {
    if (!item.version_id) return;
    setCarregando(item.instrument_id);
    try {
      const r = await iniciarFn({ data: { person_id: item.person_id, instrument_id: item.instrument_id } });
      window.location.href = `/responder/${r.response_id}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir este teste.");
    } finally {
      setCarregando(null);
    }
  };

  const cancelar = useMutation({
    mutationFn: (response_id: string) => cancelarFn({ data: { response_id } }),
    onSuccess: () => {
      toast.success("Tentativa cancelada.");
      qc.invalidateQueries({ queryKey: ["meus-testes-liberados"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível cancelar."),
  });

  const itens = useMemo(() => data?.itens ?? [], [data]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!data?.vinculado) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
        <MailQuestion className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-base font-medium">Ainda não encontramos seu cadastro</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Sua conta precisa usar o <span className="font-medium text-foreground">mesmo email</span> que
          seu mentor cadastrou. Se você entrou com outro, saia e entre de novo com o email correto —
          ou peça ao seu mentor para conferir o cadastro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Testes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os testes liberados para você. Responda quando quiser, um de cada vez — não precisa
          terminar tudo numa sentada só.
        </p>
      </div>

      {itens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
          <FlaskConical className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-base font-medium">Nenhum teste disponível ainda</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando seu mentor liberar um teste para o seu grupo, ele aparece aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {itens.map((item) => {
            const { aberta, vigente, totalConcluidas } = resumo(item.tentativas);
            return (
              <div key={item.instrument_id} className="rounded-xl border bg-card p-5 ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium">{item.nome}</h3>
                    <p className="text-xs text-muted-foreground">
                      {item.duration_min} min
                      {totalConcluidas > 1 && ` · ${totalConcluidas} aplicações`}
                    </p>
                  </div>
                  <EstadoIcone aberta={!!aberta} vigente={!!vigente} />
                </div>

                {!item.version_id ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Este teste foi liberado, mas ainda não há uma versão pronta para responder.
                    Fale com seu mentor.
                  </p>
                ) : (
                  <>
                    {vigente && !aberta && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Concluído em {new Date(vigente.submitted_at!).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {aberta && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {aberta.started_at ? "Em andamento — você já começou este." : "Pronto para começar."}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {aberta ? (
                        <>
                          <Button size="sm" onClick={() => abrirTeste(item)} disabled={carregando === item.instrument_id}>
                            {aberta.started_at ? "Continuar" : "Começar"}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">Cancelar</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancelar esta tentativa?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O que você já respondeu nesta tentativa vai se perder. Você pode
                                  começar de novo quando quiser — isso não afeta nenhum resultado
                                  anterior.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Voltar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => cancelar.mutate(aberta.response_id)}>
                                  Cancelar tentativa
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : vigente ? (
                        <>
                          <a
                            href={`/relatorio/${vigente.response_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                          >
                            Ver relatório
                          </a>
                          <Button
                            size="sm" variant="outline" onClick={() => abrirTeste(item)}
                            disabled={carregando === item.instrument_id}
                          >
                            <RotateCcw className="size-3.5" /> Refazer
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => abrirTeste(item)} disabled={carregando === item.instrument_id}>
                          Responder
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EstadoIcone({ aberta, vigente }: { aberta: boolean; vigente: boolean }) {
  if (aberta) return <Clock className="size-5 shrink-0 text-amber-500" />;
  if (vigente) return <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />;
  return <FlaskConical className="size-5 shrink-0 text-muted-foreground" />;
}
