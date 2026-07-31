/**
 * Mentorias do aluno — o arquivo dele.
 *
 * Ele não executa nada além do checklist: vê as sessões agendadas, vê o
 * resumo das concluídas, marca os itens. Não agenda, não conclui, não edita
 * resumo — nem a tela oferece o botão, nem o servidor aceitaria (RLS não tem
 * policy de UPDATE de sessão para o aluno).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMinhasMentorias, marcarTarefaMentoria } from "@/lib/student.functions";
import { Agenda } from "@/components/agenda";
import { CalendarClock, CheckCircle2, MapPin, Link2, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

function dataHoraBr(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Mentorias() {
  const qc = useQueryClient();
  const fn = useServerFn(getMinhasMentorias);
  const marcarFn = useServerFn(marcarTarefaMentoria);
  const { data, isLoading } = useQuery({ queryKey: ["minhas-mentorias"], queryFn: () => fn() });

  const marcar = useMutation({
    mutationFn: (v: { tarefa_id: string; concluida: boolean }) => marcarFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["minhas-mentorias"] }),
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
          <Agenda area="aluno" somenteMinhas />
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
                              disabled={marcar.isPending}
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
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const Route = createFileRoute("/aluno/mentorias")({
  head: () => ({
    meta: [
      { title: "Mentorias — Métrica Humana" },
      { name: "description", content: "Suas sessões de mentoria, o resumo e o checklist de cada encontro." },
    ],
  }),
  component: Mentorias,
});
