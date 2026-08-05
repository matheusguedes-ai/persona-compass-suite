/**
 * O pacote aberto: cabeçalho com a conta, sessões em ordem de data.
 *
 * "Marcar como concluída" e "editar resumo depois" usam o mesmo diálogo —
 * ver o comentário de `salvarResumoSessao` no server. A diferença de tela é
 * só: na primeira vez pede os itens do checklist; depois, eles só aparecem
 * (o professor não edita item — a spec não descreve essa edição).
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMentoria, agendarSessao, salvarResumoSessao, atualizarMentoria, anexarArquivoMentoria, cancelarSessaoMentoria,
} from "@/lib/mentorias.functions";
import {
  listarLinksAtivos, horariosParaRemarcarProfessor, remarcarSessaoMentoria,
} from "@/lib/agendamento.functions";
import { SeletorDeHorario, type Dia } from "@/components/seletor-de-horario";
import { supabase } from "@/integrations/supabase/client";
import { ACCEPT, erroDeUpload } from "@/lib/erro-de-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, CalendarClock, CalendarX2, CheckCircle2, MapPin, Link2, Plus, X, Pencil, Star, Paperclip, FileText, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function Estrelas({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("size-3.5", i <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
        />
      ))}
    </span>
  );
}

function dataHoraBr(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function paraCampoLocal(iso: string) {
  const d = new Date(iso);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
function paraIso(local: string) {
  return local ? new Date(local).toISOString() : null;
}

export function MentoriaDetalhe({ id }: { id: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getMentoria);
  const agendarFn = useServerFn(agendarSessao);
  const salvarResumoFn = useServerFn(salvarResumoSessao);
  const atualizarFn = useServerFn(atualizarMentoria);
  const anexarFn = useServerFn(anexarArquivoMentoria);
  const linksFn = useServerFn(listarLinksAtivos);

  const { data, isLoading, error } = useQuery({
    queryKey: ["mentoria", id], queryFn: () => getFn({ data: { id } }),
  });

  const recarregar = () => qc.invalidateQueries({ queryKey: ["mentoria", id] });

  // --- Agendar sessão ---------------------------------------------------
  const [agendando, setAgendando] = useState(false);
  const [quando, setQuando] = useState("");
  const [terminaEm, setTerminaEm] = useState("");
  const [modalidade, setModalidade] = useState<"presencial" | "online">("online");
  const [local, setLocal] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const agendar = useMutation({
    mutationFn: () =>
      agendarFn({
        data: {
          mentoria_id: id,
          quando: paraIso(quando)!,
          termina_em: paraIso(terminaEm),
          modalidade,
          local: modalidade === "presencial" ? local : undefined,
          link_url: modalidade === "online" ? linkUrl : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Sessão agendada.");
      setAgendando(false); setQuando(""); setTerminaEm(""); setLocal(""); setLinkUrl("");
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Aumentar o pacote / escolher o link --------------------------------
  const [editandoPacote, setEditandoPacote] = useState(false);
  const [novaQtd, setNovaQtd] = useState("");
  const [novoLinkId, setNovoLinkId] = useState("");
  const { data: linksData } = useQuery({
    queryKey: ["links-ativos"], queryFn: () => linksFn(), enabled: editandoPacote,
  });
  const salvarPacote = useMutation({
    mutationFn: () => atualizarFn({ data: { id, sessoes_contratadas: Number(novaQtd), link_id: novoLinkId || null } }),
    onSuccess: () => { toast.success("Pacote atualizado."); setEditandoPacote(false); recarregar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Cancelar / remarcar pelo professor (#257) --------------------------
  // As regras do aluno (prazo, teto de remarcações) não valem aqui — o
  // professor é o dono da agenda. Ver o comentário no topo de
  // agendamento.functions.ts, seção "#257".
  const cancelarFn = useServerFn(cancelarSessaoMentoria);
  const horariosRemarcarFn = useServerFn(horariosParaRemarcarProfessor);
  const remarcarProfFn = useServerFn(remarcarSessaoMentoria);

  const [motivoCancelar, setMotivoCancelar] = useState("");
  const cancelar = useMutation({
    mutationFn: (sessaoId: string) => cancelarFn({ data: { id: sessaoId, motivo: motivoCancelar.trim() || undefined } }),
    onSuccess: () => { toast.success("Sessão cancelada."); setMotivoCancelar(""); recarregar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [remarcandoId, setRemarcandoId] = useState<string | null>(null);
  const [diaRemarcar, setDiaRemarcar] = useState<string | null>(null);
  const [horarioRemarcar, setHorarioRemarcar] = useState<string | null>(null);

  const { data: horariosRemarcarData, isLoading: carregandoHorariosRemarcar } = useQuery({
    queryKey: ["sessao-horarios-remarcar-professor", remarcandoId],
    queryFn: () => horariosRemarcarFn({ data: { id: remarcandoId! } }),
    enabled: !!remarcandoId,
  });
  const diasRemarcar: Dia[] = horariosRemarcarData?.status === "ok" ? horariosRemarcarData.dias : [];
  const diaRemarcarAtivo = diaRemarcar ?? diasRemarcar[0]?.data ?? null;

  function comecarRemarcar(sessaoId: string) {
    setDiaRemarcar(null); setHorarioRemarcar(null); setRemarcandoId(sessaoId);
  }

  const remarcar = useMutation({
    mutationFn: () => remarcarProfFn({ data: { id: remarcandoId!, quando: horarioRemarcar! } }),
    onSuccess: () => {
      toast.success("Sessão remarcada.");
      setRemarcandoId(null); setDiaRemarcar(null); setHorarioRemarcar(null);
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Concluir / editar resumo ------------------------------------------
  type Sessao = NonNullable<typeof data>["sessoes"][number];
  const [resumindo, setResumindo] = useState<Sessao | null>(null);
  const [duracao, setDuracao] = useState("");
  const [resumo, setResumo] = useState("");
  const [checklistTitulo, setChecklistTitulo] = useState("");
  const [novosItens, setNovosItens] = useState<string[]>([""]);
  const [arquivosResumindo, setArquivosResumindo] = useState<Sessao["arquivos"]>([]);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);

  const abrirResumo = (s: Sessao) => {
    setResumindo(s);
    setDuracao(s.duracao_real_min ? String(s.duracao_real_min) : "");
    setResumo(s.resumo ?? "");
    setChecklistTitulo(s.checklist_titulo ?? "");
    setNovosItens([""]);
    setArquivosResumindo(s.arquivos);
  };

  async function enviarArquivo(f: File) {
    setEnviandoArquivo(true);
    try {
      const { data: sessaoAuth } = await supabase.auth.getUser();
      const ext = f.name.split(".").pop() ?? "bin";
      const caminho = `${sessaoAuth.user?.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("mentorias").upload(caminho, f);
      if (error) throw new Error(erroDeUpload(error, "mentorias"));
      const row = await anexarFn({
        data: {
          sessao_id: resumindo!.id,
          nome: f.name,
          caminho,
          tamanho_bytes: f.size,
          tipo: f.type || "application/octet-stream",
        },
      });
      setArquivosResumindo((atual) => [
        ...atual,
        { id: row.id, nome: f.name, tamanho_bytes: f.size, tipo: f.type, url: null },
      ]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviandoArquivo(false);
    }
  }

  const salvarResumo = useMutation({
    mutationFn: () =>
      salvarResumoFn({
        data: {
          id: resumindo!.id,
          duracao_real_min: Number(duracao),
          resumo,
          checklist_titulo: checklistTitulo.trim() || undefined,
          itens: resumindo!.status === "agendada"
            ? novosItens.map((t) => t.trim()).filter(Boolean)
            : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(resumindo?.status === "agendada" ? "Sessão concluída." : "Resumo atualizado.");
      setResumindo(null);
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message ?? "Erro"}</p>;

  const { mentoria, sessoes } = data;

  return (
    <div className="space-y-6">
      <Link to="/mentorias" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Voltar para mentorias
      </Link>

      <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {mentoria.people?.full_name ?? "—"}
              {mentoria.titulo && <span className="font-normal text-muted-foreground"> · {mentoria.titulo}</span>}
            </h1>
            {mentoria.observacoes && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{mentoria.observacoes}</p>
            )}
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => {
              setNovaQtd(String(mentoria.sessoes_contratadas));
              setNovoLinkId(mentoria.link_id ?? "");
              setEditandoPacote(true);
            }}
          >
            <Pencil className="size-3.5" /> {mentoria.sessoes_contratadas} contratadas
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <span><strong className="tabular-nums">{mentoria.realizadas}</strong> realizadas</span>
          <span><strong className="tabular-nums">{mentoria.agendadas}</strong> agendadas</span>
          <span><strong className="tabular-nums">{mentoria.faltam}</strong> a agendar</span>
          {mentoria.satisfacao && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              satisfação{" "}
              <strong className="tabular-nums text-foreground">
                {mentoria.satisfacao.media.toFixed(1).replace(".", ",")}
              </strong>{" "}
              ({mentoria.satisfacao.avaliacoes} {mentoria.satisfacao.avaliacoes === 1 ? "avaliação" : "avaliações"})
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setAgendando(true)}>
          <CalendarClock className="size-4" /> Agendar sessão
        </Button>
      </div>

      {sessoes.length === 0 && (
        <p className="rounded-xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          Nenhuma sessão agendada ainda.
        </p>
      )}

      <ul className="space-y-3">
        {sessoes.map((s) => (
          <li
            key={s.id}
            className={`rounded-xl border border-black/5 bg-card p-4 ${s.status === "cancelada" ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  {s.status === "concluida" ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : s.status === "cancelada" ? (
                    <XCircle className="size-4 text-muted-foreground" />
                  ) : (
                    <CalendarClock className="size-4" />
                  )}
                  <span className={s.status === "cancelada" ? "line-through" : ""}>{dataHoraBr(s.quando)}</span>
                  {s.status === "cancelada" && (
                    <span className="font-normal text-muted-foreground">
                      — Cancelada{s.cancelada_por === "aluno" ? " pelo aluno" : s.cancelada_por === "mentor" ? " por você" : ""}
                    </span>
                  )}
                </p>
                {s.status === "cancelada" && s.cancelamento_motivo && (
                  <p className="mt-1 text-xs text-muted-foreground">Motivo: {s.cancelamento_motivo}</p>
                )}
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {s.modalidade === "presencial" ? <MapPin className="size-3" /> : <Link2 className="size-3" />}
                  {s.modalidade === "presencial" ? (s.local || "presencial") : (s.link_url || "online")}
                </p>
              </div>
              {s.status === "agendada" && remarcandoId !== s.id && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => abrirResumo(s)}>
                    <CheckCircle2 className="size-3.5" /> Marcar como concluída
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => comecarRemarcar(s.id)}>
                    <CalendarClock className="size-3.5" /> Remarcar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm" variant="outline" className="text-destructive hover:text-destructive"
                        onClick={() => setMotivoCancelar("")}
                      >
                        <CalendarX2 className="size-3.5" /> Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar esta sessão?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {dataHoraBr(s.quando)}. Essa ação não pode ser desfeita. {mentoria.people?.full_name ?? "O aluno"} é avisado por e-mail.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div>
                        <label className="text-sm font-medium">Motivo (opcional)</label>
                        <Textarea
                          value={motivoCancelar}
                          onChange={(e) => setMotivoCancelar(e.target.value)}
                          rows={2}
                          className="mt-1.5"
                          placeholder="Só se quiser explicar ao aluno"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => cancelar.mutate(s.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {cancelar.isPending ? "Cancelando…" : "Cancelar sessão"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
              {s.status === "concluida" && (
                <Button size="sm" variant="outline" onClick={() => abrirResumo(s)}>
                  <Pencil className="size-3.5" /> Editar resumo
                </Button>
              )}
            </div>

            {s.status === "agendada" && remarcandoId === s.id && (
              <div className="mt-3 space-y-3 border-t border-black/5 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Escolha o novo horário:</p>
                  <Button variant="ghost" size="sm" onClick={() => setRemarcandoId(null)} disabled={remarcar.isPending}>
                    Voltar
                  </Button>
                </div>
                {carregandoHorariosRemarcar && <p className="text-sm text-muted-foreground">Buscando horários livres…</p>}
                {!carregandoHorariosRemarcar && diasRemarcar.length === 0 && (
                  <p className="text-sm text-muted-foreground">Não há horários disponíveis no momento.</p>
                )}
                {diasRemarcar.length > 0 && diaRemarcarAtivo && (
                  <SeletorDeHorario
                    dias={diasRemarcar}
                    diaSelecionado={diaRemarcarAtivo}
                    horarioSelecionado={horarioRemarcar}
                    onSelecionarDia={setDiaRemarcar}
                    onSelecionarHorario={setHorarioRemarcar}
                  />
                )}
                <Button
                  className="w-full" disabled={!horarioRemarcar || remarcar.isPending}
                  onClick={() => remarcar.mutate()}
                >
                  {remarcar.isPending ? "Confirmando…" : "Confirmar novo horário"}
                </Button>
              </div>
            )}

            {s.status === "concluida" && (
              <div className="mt-3 space-y-3 border-t border-black/5 pt-3">
                <p className="text-xs text-muted-foreground">{s.duracao_real_min} minutos</p>
                {s.resumo && <p className="text-sm leading-relaxed">{s.resumo}</p>}
                {s.tarefas.length > 0 && (
                  <div>
                    {s.checklist_titulo && <p className="text-xs font-medium">{s.checklist_titulo}</p>}
                    <ul className="mt-1.5 space-y-1">
                      {s.tarefas.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 text-xs">
                          <span className={cn("size-3 shrink-0 rounded-sm border", t.concluida ? "border-emerald-600 bg-emerald-600" : "border-muted-foreground/40")} />
                          <span className={t.concluida ? "text-muted-foreground line-through" : ""}>{t.titulo}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.arquivos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {s.arquivos.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                        <Paperclip className="size-3" /> {a.nome}
                      </span>
                    ))}
                  </div>
                )}
                <div className="rounded-lg bg-muted/30 p-3">
                  {s.avaliacao_estrelas ? (
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-medium">
                        <Estrelas n={s.avaliacao_estrelas} />
                        {mentoria.people?.full_name ?? "aluno"}
                      </p>
                      {s.avaliacao_comentario && (
                        <p className="text-sm leading-relaxed">{s.avaliacao_comentario}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aguardando avaliação do aluno.</p>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* ---------------------------------------------------- agendar --- */}
      <Dialog open={agendando} onOpenChange={(v) => !v && setAgendando(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar sessão</DialogTitle>
            <DialogDescription>{mentoria.people?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Início</label>
                <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium">Fim (opcional)</label>
                <Input type="datetime-local" value={terminaEm} onChange={(e) => setTerminaEm(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Modalidade</label>
              <div className="mt-1.5 flex gap-2">
                <Button
                  type="button" variant={modalidade === "online" ? "default" : "outline"} size="sm"
                  onClick={() => setModalidade("online")}
                >
                  Online
                </Button>
                <Button
                  type="button" variant={modalidade === "presencial" ? "default" : "outline"} size="sm"
                  onClick={() => setModalidade("presencial")}
                >
                  Presencial
                </Button>
              </div>
            </div>
            {modalidade === "online" ? (
              <div>
                <label className="text-sm font-medium">Link da chamada</label>
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="mt-1.5" placeholder="https://…" />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Endereço</label>
                <Input value={local} onChange={(e) => setLocal(e.target.value)} className="mt-1.5" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAgendando(false)}>Cancelar</Button>
            <Button onClick={() => agendar.mutate()} disabled={!quando || agendar.isPending}>
              {agendar.isPending ? "Agendando…" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------- aumentar pacote --- */}
      <Dialog open={editandoPacote} onOpenChange={setEditandoPacote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sessões contratadas</DialogTitle>
            <DialogDescription>Fechou mais sessões? Edite o total — não crie um pacote novo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="number" min={1} max={999} value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} />
            <div>
              <label className="text-sm font-medium">Link de agendamento (opcional)</label>
              <select
                value={novoLinkId}
                onChange={(e) => setNovoLinkId(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Sem link — só você agenda</option>
                {(linksData?.links ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.titulo} ({l.duracao_min} min)</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Com um link escolhido, {mentoria.people?.full_name ?? "o aluno"} pode agendar sozinho pelo próprio painel.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditandoPacote(false)}>Cancelar</Button>
            <Button onClick={() => salvarPacote.mutate()} disabled={!novaQtd || salvarPacote.isPending}>
              {salvarPacote.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------ resumo --- */}
      <Dialog open={!!resumindo} onOpenChange={(v) => !v && setResumindo(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {resumindo?.status === "agendada" ? "Concluir sessão" : "Editar resumo"}
            </DialogTitle>
            <DialogDescription>
              {resumindo && dataHoraBr(resumindo.quando)}. Salvar {resumindo?.status === "agendada" ? "publica" : "atualiza"} para o aluno na hora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Duração real (min)</label>
              <Input
                type="number" min={1} max={600} value={duracao}
                onChange={(e) => setDuracao(e.target.value)} className="mt-1.5" placeholder="60"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Resumo</label>
              <Textarea value={resumo} onChange={(e) => setResumo(e.target.value)} rows={5} className="mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-medium">Nome do checklist (opcional)</label>
              <Input
                value={checklistTitulo} onChange={(e) => setChecklistTitulo(e.target.value)} className="mt-1.5"
                placeholder="Ex.: Desafios até o próximo encontro"
              />
            </div>

            {resumindo?.status === "agendada" ? (
              <div>
                <label className="text-sm font-medium">Itens do checklist</label>
                <div className="mt-1.5 space-y-2">
                  {novosItens.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={item}
                        onChange={(e) => setNovosItens(novosItens.map((v, j) => (j === i ? e.target.value : v)))}
                        placeholder={`Item ${i + 1}`}
                      />
                      {novosItens.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => setNovosItens(novosItens.filter((_, j) => j !== i))}>
                          <X className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setNovosItens([...novosItens, ""])}>
                  <Plus className="size-3.5" /> Adicionar item
                </Button>
              </div>
            ) : (
              resumindo && resumindo.tarefas.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Itens do checklist</label>
                  <ul className="mt-1.5 space-y-1">
                    {resumindo.tarefas.map((t) => (
                      <li key={t.id} className="text-xs text-muted-foreground">
                        {t.concluida ? "☑" : "☐"} {t.titulo}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}

            <div>
              <label className="text-sm font-medium">Arquivos anexados</label>
              <div className="mt-1.5 space-y-1.5">
                {(arquivosResumindo ?? []).map((a) => (
                  <p key={a.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="size-3.5 shrink-0" /> {a.nome}
                  </p>
                ))}
              </div>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                <Paperclip className="size-3.5" />
                {enviandoArquivo ? "Enviando…" : "Anexar arquivo"}
                <input
                  type="file"
                  accept={ACCEPT.mentorias}
                  className="hidden"
                  disabled={enviandoArquivo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void enviarArquivo(f);
                  }}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResumindo(null)}>Cancelar</Button>
            <Button
              onClick={() => salvarResumo.mutate()}
              disabled={!duracao || !resumo.trim() || salvarResumo.isPending}
            >
              {salvarResumo.isPending ? "Salvando…" : resumindo?.status === "agendada" ? "Concluir" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
