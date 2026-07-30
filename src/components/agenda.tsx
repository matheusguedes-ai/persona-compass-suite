/**
 * Agenda de devolutivas — visão de mês.
 *
 * Todo cálculo de data acontece AQUI, no navegador, e o período vai pronto para
 * o servidor. O servidor roda em UTC: se ele decidisse onde o mês começa,
 * viraria o mês três horas antes do Brasil e a devolutiva do último dia às 22h
 * sumiria da tela.
 *
 * Serve o master (`/gestao`) e o mentor (`/aluno/gestao`) sem mudar nada: a RLS
 * já recorta os dados de cada um.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { agendaDoMes, excluirEvento, type Compromisso } from "@/lib/gestao.functions";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, ExternalLink, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { NovoEvento } from "@/components/novo-evento";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function mesmoDia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function horaBr(iso: string): string | null {
  const d = new Date(iso);
  // Meia-noite em ponto quase sempre significa "sem hora definida", não 00:00.
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * `area` decide só para ONDE o compromisso leva — o mentor e o aluno vivem os
 * dois em /aluno, então ela não serve para decidir escopo.
 *
 * `somenteMinhas` é separado de propósito: o mentor abre a agenda em
 * `/aluno/gestao` e precisa ver o GRUPO dele; o aluno abre em
 * `/aluno/devolutivas` e precisa ver só o que é dele. Amarrar as duas coisas na
 * mesma prop deixaria o mentor com uma agenda quase sempre vazia.
 */
export function Agenda({
  area = "dono",
  somenteMinhas = false,
  podeCriar = false,
}: {
  area?: "dono" | "aluno";
  somenteMinhas?: boolean;
  /** Só o master cria evento — o mentor não publica novidade para os grupos. */
  podeCriar?: boolean;
}) {
  const hoje = new Date();
  const [ref, setRef] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  // O compromisso aberto no pop-up. Null = fechado.
  const [aberto, setAberto] = useState<Compromisso | null>(null);
  const qc = useQueryClient();
  const excluirFn = useServerFn(excluirEvento);
  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Evento excluído.");
      qc.invalidateQueries({ queryKey: ["agenda"] });
      setAberto(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // O intervalo do mês, em horário LOCAL, convertido para ISO com fuso.
  const { de, ate } = useMemo(
    () => ({
      de: new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0).toISOString(),
      ate: new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 0, 0, 0).toISOString(),
    }),
    [ref],
  );

  const fn = useServerFn(agendaDoMes);
  const { data, isLoading } = useQuery({
    queryKey: ["agenda", de, ate, somenteMinhas],
    queryFn: () => fn({ data: { de, ate, somenteMinhas } }),
  });

  const compromissos = data?.compromissos ?? [];

  // As células do calendário: dias do mês, precedidos dos vazios até cair no
  // dia da semana certo.
  const celulas = useMemo(() => {
    const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const diasNoMes = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const vazios = Array.from({ length: primeiro.getDay() }, () => null);
    const dias = Array.from(
      { length: diasNoMes },
      (_, i) => new Date(ref.getFullYear(), ref.getMonth(), i + 1),
    );
    return [...vazios, ...dias];
  }, [ref]);

  const doDia = (d: Date): Compromisso[] =>
    compromissos.filter((c) => mesmoDia(new Date(c.quando), d));

  const proximos = compromissos
    .filter((c) => new Date(c.quando).getTime() >= Date.now())
    .slice(0, 5);

  const rotuloMes = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-40 text-sm font-medium capitalize">{rotuloMes}</span>
        <Button
          variant="outline" size="sm"
          onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="ghost" size="sm"
          onClick={() => setRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
        >
          Hoje
        </Button>
        {isLoading && <span className="text-xs text-muted-foreground">carregando…</span>}
        {podeCriar && <NovoEvento />}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[42rem]">
          <div className="grid grid-cols-7 gap-1 pb-1">
            {SEMANA.map((d) => (
              <div key={d} className="px-1 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {celulas.map((d, i) => {
              if (!d) return <div key={`v${i}`} />;
              const itens = doDia(d);
              const ehHoje = mesmoDia(d, hoje);
              return (
                <div
                  key={d.toISOString()}
                  className={`min-h-20 rounded-lg p-1.5 ring-1 ${
                    ehHoje ? "bg-primary/5 ring-primary/40" : "bg-card ring-black/5"
                  }`}
                >
                  <span
                    className={`text-xs tabular-nums ${
                      ehHoje ? "font-semibold text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <ul className="mt-1 space-y-1">
                    {itens.map((c) => (
                      <li key={c.id}>
                        {c.tipo === "evento" ? (
                          // Evento não é conversa com ninguém: não há para onde
                          // levar, então não vira link.
                          <button
                            onClick={() => setAberto(c)}
                            className="block w-full truncate rounded bg-violet-500/10 px-1.5 py-1 text-left text-[11px] leading-tight text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
                            title="Ver detalhes"
                          >
                            {horaBr(c.quando) && (
                              <span className="font-medium tabular-nums">{horaBr(c.quando)} </span>
                            )}
                            {c.person_name}
                          </button>
                        ) : (
                          <Link
                            to={area === "aluno" ? "/aluno/devolutivas" : "/devolutivas"}
                            className={`block truncate rounded px-1.5 py-1 text-[11px] leading-tight ${
                              c.status === "realizada"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : c.atrasada
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                            }`}
                            title={`${c.person_name}${horaBr(c.quando) ? ` · ${horaBr(c.quando)}` : ""}`}
                          >
                            {horaBr(c.quando) && (
                              <span className="font-medium tabular-nums">{horaBr(c.quando)} </span>
                            )}
                            {c.person_name}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tudo do evento junto, num lugar só — era o que faltava: dava para
          criar com imagem e link e não havia onde vê-los. */}
      <Dialog open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent className="flex max-w-lg flex-col">
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle>{aberto.person_name}</DialogTitle>
              </DialogHeader>

              {aberto.imagem_url && (
                <img
                  src={aberto.imagem_url} alt=""
                  className="max-h-56 w-full rounded-lg object-cover"
                />
              )}

              <div className="flex items-start gap-2 text-sm">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {new Date(aberto.quando).toLocaleDateString("pt-BR", {
                    weekday: "long", day: "2-digit", month: "long",
                  })}
                  {horaBr(aberto.quando) && ` · ${horaBr(aberto.quando)}`}
                  {aberto.termina_em && horaBr(aberto.termina_em) && ` às ${horaBr(aberto.termina_em)}`}
                </span>
              </div>

              {aberto.descricao && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {aberto.descricao}
                </p>
              )}

              {aberto.link_url && (
                <a
                  href={aberto.link_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <ExternalLink className="size-3.5" /> Abrir link
                </a>
              )}

              {/* Sem este aviso, apagar aqui pareceria não funcionar: o evento
                  volta no próximo salvamento da aula, que é a fonte dele. */}
              {aberto.de_aula && (
                <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                  Este encontro vem de uma <strong>aula do Classroom</strong>. Ele acompanha a aula:
                  mudar a data lá muda aqui, e apagar aqui não apaga a aula.
                </p>
              )}

              {/* Só quem cria pode excluir — a mesma condição do botão "Novo
                  evento". A RLS barra de verdade; isto evita oferecer o que a
                  pessoa não pode fazer. */}
              {podeCriar && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm"
                      className="mt-2 self-start text-destructive hover:text-destructive">
                      <Trash2 className="size-3.5" /> Excluir evento
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir "{aberto.person_name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O evento some da agenda de todas as pessoas que o receberam — e também
                        do seu Google Calendar, se estiver conectado. Não dá para desfazer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => excluir.mutate(aberto.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* O calendário mostra o mês; esta lista responde "e agora, o que vem?" */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-black/5">
        <h3 className="text-sm font-medium">Próximos</h3>
        {proximos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nada marcado daqui para a frente neste mês.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proximos.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                {c.tipo === "evento" ? (
                  <button onClick={() => setAberto(c)} className="truncate text-left hover:underline">
                    {c.person_name}
                  </button>
                ) : (
                  <span className="truncate">{c.person_name}</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(c.quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  {horaBr(c.quando) ? ` · ${horaBr(c.quando)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
