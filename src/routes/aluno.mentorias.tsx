/**
 * Mentorias do aluno — o arquivo dele.
 *
 * Ele não executa nada além do checklist: vê as sessões agendadas, vê o
 * resumo das concluídas, marca os itens. Não agenda, não conclui, não edita
 * resumo — nem a tela oferece o botão, nem o servidor aceitaria (RLS não tem
 * policy de UPDATE de sessão para o aluno).
 */
import { mensagemDeErro } from "@/lib/erro-legivel";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMinhasMentorias, marcarTarefaMentoria, avaliarSessaoMentoria } from "@/lib/student.functions";
import {
  horariosParaAgendarNoPainel, agendarNoPainel, cancelarSessaoAluno, horariosParaRemarcar, remarcarSessaoAluno,
} from "@/lib/agendamento.functions";
import { Agenda } from "@/components/agenda";
import { SeletorDeHorario, type Dia } from "@/components/seletor-de-horario";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CalendarClock, CalendarX2, CheckCircle2, MapPin, Link2, MessagesSquare, Star, FileText, Download,
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
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  // --- Agendar mentoria (por pacote, #255) --------------------------------
  const horariosPainelFn = useServerFn(horariosParaAgendarNoPainel);
  const agendarPainelFn = useServerFn(agendarNoPainel);
  const [agendandoPacoteId, setAgendandoPacoteId] = useState<string | null>(null);
  const [diaPacote, setDiaPacote] = useState<string | null>(null);
  const [horarioPacote, setHorarioPacote] = useState<string | null>(null);

  const { data: horariosPacoteData, isLoading: carregandoHorariosPacote } = useQuery({
    queryKey: ["pacote-horarios-agendar", agendandoPacoteId, ver ?? null],
    queryFn: () => horariosPainelFn({ data: { mentoria_id: agendandoPacoteId!, preview_person_id: ver ?? null } }),
    enabled: !!agendandoPacoteId,
  });
  const diasPacote: Dia[] = horariosPacoteData?.status === "ok" ? horariosPacoteData.dias : [];
  const diaPacoteAtivo = diaPacote ?? diasPacote[0]?.data ?? null;

  function comecarAgendarPacote(pacoteId: string) {
    setDiaPacote(null); setHorarioPacote(null); setAgendandoPacoteId(pacoteId);
  }

  const agendarPacote = useMutation({
    mutationFn: () =>
      agendarPainelFn({ data: { mentoria_id: agendandoPacoteId!, quando: horarioPacote!, preview_person_id: ver ?? null } }),
    onSuccess: () => {
      toast.success("Sessão agendada.");
      setAgendandoPacoteId(null); setDiaPacote(null); setHorarioPacote(null);
      qc.invalidateQueries({ queryKey: ["minhas-mentorias"] });
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  // --- Cancelar / remarcar uma sessão já marcada (reaproveita o #254) -----
  const cancelarSessaoFn = useServerFn(cancelarSessaoAluno);
  const horariosRemarcarFn = useServerFn(horariosParaRemarcar);
  const remarcarSessaoFn = useServerFn(remarcarSessaoAluno);
  const [remarcandoSessaoId, setRemarcandoSessaoId] = useState<string | null>(null);
  const [diaSessao, setDiaSessao] = useState<string | null>(null);
  const [horarioSessao, setHorarioSessao] = useState<string | null>(null);

  const cancelarSessao = useMutation({
    mutationFn: (sessaoId: string) => cancelarSessaoFn({ data: { id: sessaoId } }),
    onSuccess: () => {
      toast.success("Sessão cancelada.");
      qc.invalidateQueries({ queryKey: ["minhas-mentorias"] });
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const { data: horariosSessaoData, isLoading: carregandoHorariosSessao } = useQuery({
    queryKey: ["sessao-horarios-remarcar", remarcandoSessaoId],
    queryFn: () => horariosRemarcarFn({ data: { id: remarcandoSessaoId! } }),
    enabled: !!remarcandoSessaoId,
  });
  const diasSessao: Dia[] = horariosSessaoData?.status === "ok" ? horariosSessaoData.dias : [];
  const diaSessaoAtivo = diaSessao ?? diasSessao[0]?.data ?? null;

  function comecarRemarcarSessao(sessaoId: string) {
    setDiaSessao(null); setHorarioSessao(null); setRemarcandoSessaoId(sessaoId);
  }

  const remarcarSessao = useMutation({
    mutationFn: () => remarcarSessaoFn({ data: { id: remarcandoSessaoId!, quando: horarioSessao! } }),
    onSuccess: () => {
      toast.success("Sessão remarcada.");
      setRemarcandoSessaoId(null); setDiaSessao(null); setHorarioSessao(null);
      qc.invalidateQueries({ queryKey: ["minhas-mentorias"] });
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const lista = data?.sessoes ?? [];
  const pacotes = data?.pacotes ?? [];
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

      {!isLoading && pacotes.length > 0 && (
        <section className="space-y-3">
          {agendandoPacoteId ? (
            <div className="rounded-xl border border-black/5 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  Agendar: {pacotes.find((p) => p.id === agendandoPacoteId)?.titulo || "sua mentoria"}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setAgendandoPacoteId(null)}>Voltar</Button>
              </div>
              <div className="mt-3 space-y-3">
                {carregandoHorariosPacote && <p className="text-sm text-muted-foreground">Buscando horários livres…</p>}
                {!carregandoHorariosPacote && diasPacote.length === 0 && (
                  <p className="text-sm text-muted-foreground">Não há horários disponíveis no momento.</p>
                )}
                {diasPacote.length > 0 && diaPacoteAtivo && (
                  <SeletorDeHorario
                    dias={diasPacote}
                    diaSelecionado={diaPacoteAtivo}
                    horarioSelecionado={horarioPacote}
                    onSelecionarDia={setDiaPacote}
                    onSelecionarHorario={setHorarioPacote}
                  />
                )}
                <Button
                  className="w-full" disabled={!horarioPacote || agendarPacote.isPending}
                  onClick={() => agendarPacote.mutate()}
                >
                  {agendarPacote.isPending ? "Confirmando…" : "Confirmar horário"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {pacotes.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-black/5 bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.titulo || "Mentoria"}</p>
                    {!p.podeAgendar.sim && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.podeAgendar.motivo}</p>
                    )}
                    {p.podeAgendar.sim && ver && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Agendamento é feito pelo próprio aluno.</p>
                    )}
                  </div>
                  <Button size="sm" disabled={!p.podeAgendar.sim || !!ver} onClick={() => comecarAgendarPacote(p.id)}>
                    <CalendarClock className="size-4" /> Agendar mentoria
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
            {agendadas.map((s) => {
              const motivoCancelar = s.podeCancelar.sim ? null : s.podeCancelar.motivo;
              const motivoRemarcar = s.podeRemarcar.sim ? null : s.podeRemarcar.motivo;
              return (
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

                {remarcandoSessaoId === s.id ? (
                  <div className="mt-3 space-y-3 border-t border-black/5 pt-3">
                    <p className="text-sm font-medium">Escolha o novo horário:</p>
                    {carregandoHorariosSessao && <p className="text-sm text-muted-foreground">Buscando horários livres…</p>}
                    {!carregandoHorariosSessao && diasSessao.length === 0 && (
                      <p className="text-sm text-muted-foreground">Não há horários disponíveis no momento.</p>
                    )}
                    {diasSessao.length > 0 && diaSessaoAtivo && (
                      <SeletorDeHorario
                        dias={diasSessao}
                        diaSelecionado={diaSessaoAtivo}
                        horarioSelecionado={horarioSessao}
                        onSelecionarDia={setDiaSessao}
                        onSelecionarHorario={setHorarioSessao}
                      />
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setRemarcandoSessaoId(null)} disabled={remarcarSessao.isPending}>
                        Voltar
                      </Button>
                      <Button
                        size="sm" disabled={!horarioSessao || remarcarSessao.isPending}
                        onClick={() => remarcarSessao.mutate()}
                      >
                        {remarcarSessao.isPending ? "Confirmando…" : "Confirmar novo horário"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  (s.podeCancelar.sim || s.podeRemarcar.sim || motivoCancelar || motivoRemarcar) && (
                    <div className="mt-3 space-y-1.5 border-t border-black/5 pt-3">
                      <div className="flex flex-wrap gap-2">
                        {s.podeRemarcar.sim && !ver && (
                          <Button size="sm" variant="outline" onClick={() => comecarRemarcarSessao(s.id)}>
                            <CalendarClock className="size-3.5" /> Escolher outro horário
                          </Button>
                        )}
                        {s.podeCancelar.sim && !ver && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                                <CalendarX2 className="size-3.5" /> Cancelar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancelar esta sessão?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {dataHoraBr(s.quando)}. Essa ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Voltar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelarSessao.mutate(s.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Cancelar sessão
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      {motivoRemarcar && (
                        <p className="text-xs text-muted-foreground">{motivoRemarcar}</p>
                      )}
                      {motivoCancelar && motivoCancelar !== motivoRemarcar && (
                        <p className="text-xs text-muted-foreground">{motivoCancelar}</p>
                      )}
                    </div>
                  )
                )}
              </li>
              );
            })}
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
