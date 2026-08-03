/**
 * Mentorias do aluno — o arquivo dele.
 *
 * Ele não executa nada além do checklist: vê as sessões agendadas, vê o
 * resumo das concluídas, marca os itens. Não agenda, não conclui, não edita
 * resumo — nem a tela oferece o botão, nem o servidor aceitaria (RLS não tem
 * policy de UPDATE de sessão para o aluno).
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMinhasMentorias, marcarTarefaMentoria, avaliarSessaoMentoria } from "@/lib/student.functions";
import { Agenda } from "@/components/agenda";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarClock, CheckCircle2, MapPin, Link2, MessagesSquare, Star, FileText, Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function SeletorEstrelas({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className="p-0.5"
          aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
        >
          <Star className={cn("size-5", i <= valor ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
        </button>
      ))}
    </div>
  );
}

function dataHoraBr(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Mentorias() {
  const { ver } = Route.useSearch();
  const qc = useQueryClient();
  const fn = useServerFn(getMinhasMentorias);
  const marcarFn = useServerFn(marcarTarefaMentoria);
  const avaliarFn = useServerFn(avaliarSessaoMentoria);
  const { data, isLoading } = useQuery({
    queryKey: ["minhas-mentorias", ver ?? null],
    queryFn: () => fn({ data: { preview_person_id: ver ?? null } }),
  });

  const marcar = useMutation({
    mutationFn: (v: { tarefa_id: string; concluida: boolean }) => marcarFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["minhas-mentorias"] }),
  });

  // Rascunho da avaliação por sessão, antes de enviar — uma vez enviada, o
  // dado vem do servidor (`avaliacao_estrelas`) e este rascunho não importa mais.
  const [rascunhos, setRascunhos] = useState<Record<string, { estrelas: number; comentario: string }>>({});
  const rascunho = (id: string) => rascunhos[id] ?? { estrelas: 0, comentario: "" };

  const avaliar = useMutation({
    mutationFn: (v: { sessao_id: string; estrelas: number; comentario: string }) =>
      avaliarFn({ data: { sessao_id: v.sessao_id, estrelas: v.estrelas, comentario: v.comentario.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Avaliação enviada. Obrigado!");
      qc.invalidateQueries({ queryKey: ["minhas-mentorias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = data?.sessoes ?? [];
  const agendadas = lista.filter((s) => s.status === "agendada");
  const concluidas = lista.filter((s) => s.status === "concluida");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Mentorias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suas sessões marcadas, o resumo de cada encontro e o que ficou combinado.
        </p>
      </header>

      {!isLoading && lista.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium">No calendário</h2>
          <Agenda area="aluno" somenteMinhas previewPersonId={ver ?? null} />
        </section>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && lista.length === 0 && (
        <div className="rounded-xl bg-muted/40 p-6">
          <p className="text-sm text-muted-foreground">
            Você ainda não tem mentoria marcada. Assim que seu professor agendar, ela aparece aqui.
          </p>
        </div>
      )}

      {agendadas.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Marcadas</h2>
          <ul className="mt-3 space-y-3">
            {agendadas.map((s) => (
              <li key={s.id} className="rounded-xl border border-black/5 bg-card p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CalendarClock className="size-4" /> {dataHoraBr(s.quando)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {s.modalidade === "presencial" ? <MapPin className="size-3" /> : <Link2 className="size-3" />}
                  {s.modalidade === "presencial"
                    ? (s.local || "presencial")
                    : (s.link_url
                        ? <a href={s.link_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.link_url}</a>
                        : "online")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {concluidas.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Já realizadas</h2>
          <ul className="mt-3 space-y-4">
            {concluidas.map((s) => (
              <li key={s.id} className="rounded-xl bg-muted/30 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="size-4 text-emerald-600" /> {dataHoraBr(s.quando)}
                  {s.duracao_real_min && (
                    <span className="font-normal text-xs text-muted-foreground">· {s.duracao_real_min} min</span>
                  )}
                </p>
                {s.resumo && (
                  <div className="mt-3 rounded-lg bg-background p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <MessagesSquare className="size-3" /> Resumo
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed">{s.resumo}</p>
                  </div>
                )}
                {s.tarefas.length > 0 && (
                  <div className="mt-3">
                    {s.checklist_titulo && <p className="text-xs font-medium">{s.checklist_titulo}</p>}
                    <ul className="mt-1.5 space-y-1.5">
                      {s.tarefas.map((t) => (
                        <li key={t.id}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={t.concluida}
                              disabled={marcar.isPending || !!ver}
                              onChange={(e) => marcar.mutate({ tarefa_id: t.id, concluida: e.target.checked })}
                              className="size-4 rounded border-input"
                            />
                            <span className={cn(t.concluida && "text-muted-foreground line-through")}>{t.titulo}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.arquivos.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {s.arquivos.map((a) => (
                      <a
                        key={a.id}
                        href={a.url ?? undefined}
                        download={a.nome}
                        className={cn(
                          "flex items-center gap-1.5 text-sm",
                          a.url ? "text-accent hover:underline" : "pointer-events-none text-muted-foreground",
                        )}
                      >
                        <FileText className="size-3.5" /> {a.nome} <Download className="size-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-3 border-t border-black/5 pt-3">
                  {s.avaliacao_estrelas ? (
                    <div>
                      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        Sua avaliação:
                        <span className="inline-flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={cn("size-3.5", i <= s.avaliacao_estrelas! ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
                            />
                          ))}
                        </span>
                      </p>
                      {s.avaliacao_comentario && (
                        <p className="mt-1.5 text-sm leading-relaxed">{s.avaliacao_comentario}</p>
                      )}
                    </div>
                  ) : ver ? (
                    <p className="text-xs text-muted-foreground">
                      Esta pessoa ainda não avaliou esta sessão.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-medium">Como foi esta sessão?</p>
                      <SeletorEstrelas
                        valor={rascunho(s.id).estrelas}
                        onChange={(n) => setRascunhos((v) => ({ ...v, [s.id]: { ...rascunho(s.id), estrelas: n } }))}
                      />
                      <Textarea
                        value={rascunho(s.id).comentario}
                        onChange={(e) => setRascunhos((v) => ({ ...v, [s.id]: { ...rascunho(s.id), comentario: e.target.value } }))}
                        placeholder="Comentário (opcional)"
                        rows={2}
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        disabled={rascunho(s.id).estrelas < 1 || avaliar.isPending}
                        onClick={() => avaliar.mutate({ sessao_id: s.id, ...rascunho(s.id) })}
                      >
                        {avaliar.isPending ? "Enviando…" : "Enviar avaliação"}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const Route = createFileRoute("/aluno/mentorias")({
  validateSearch: (s: Record<string, unknown>) => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Mentorias — Métrica Humana" },
      { name: "description", content: "Suas sessões de mentoria, o resumo e o checklist de cada encontro." },
    ],
  }),
  component: Mentorias,
});
