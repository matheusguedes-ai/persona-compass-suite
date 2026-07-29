/**
 * Tela de Devolutivas.
 *
 * Duas partes, e a ordem importa: primeiro a FILA — quem terminou o teste e
 * ainda não teve a conversa, com quantos dias está esperando. É a informação
 * que faz o mentor agir, e por isso vem antes da lista de registros.
 *
 * A fila é calculada, não cadastrada: assim que alguém conclui um teste,
 * aparece aqui sozinho. Ninguém precisa lembrar de incluir.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarFila, listarDevolutivas, agendarDevolutiva, registrarDevolutiva,
  atualizarDevolutiva, excluirDevolutiva, listarPessoasParaDevolutiva, type ItemDaFila,
} from "@/lib/devolutivas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarClock, CheckCircle2, FileText, Trash2, Clock, LayoutDashboard, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function dataBr(iso: string | null) {
  if (!iso) return "—";
  // Campo `date` do banco vem como "2026-08-13", sem hora. `new Date()` nesse
  // formato assume meia-noite em UTC, que no Brasil é 21h do dia ANTERIOR — e
  // a data aparecia um dia atrasada. Com hora e minuto separados, a data é
  // montada no fuso local e o dia é o que foi digitado.
  const soData = /^\d{4}-\d{2}-\d{2}$/.exec(iso);
  const d = soData
    ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
    : new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function dataHoraBr(iso: string | null) {
  if (!iso) return "sem data marcada";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
/** `datetime-local` do navegador não tem fuso; converte para ISO com offset. */
function paraIso(local: string) {
  return local ? new Date(local).toISOString() : null;
}

function Espera({ dias }: { dias: number }) {
  // Três semanas é o ponto em que a devolutiva perde a conexão com o teste:
  // a pessoa já não lembra do que respondeu.
  const cor = dias >= 21 ? "bg-red-100 text-red-800" : dias >= 7 ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", cor)}>
      <Clock className="size-3" />
      {dias === 0 ? "hoje" : dias === 1 ? "1 dia" : `${dias} dias`}
    </span>
  );
}

export function DevolutivasPage({ groupId }: { groupId?: string } = {}) {
  const qc = useQueryClient();
  const filaFn = useServerFn(listarFila);
  const listaFn = useServerFn(listarDevolutivas);
  const agendarFn = useServerFn(agendarDevolutiva);
  const registrarFn = useServerFn(registrarDevolutiva);
  const atualizarFn = useServerFn(atualizarDevolutiva);
  const excluirFn = useServerFn(excluirDevolutiva);

  const { data: filaData, isLoading: carregandoFila } = useQuery({
    queryKey: ["devolutivas-fila", groupId ?? null],
    queryFn: () => filaFn({ data: { group_id: groupId ?? null } }),
  });
  const { data: listaData, isLoading: carregandoLista } = useQuery({
    queryKey: ["devolutivas"], queryFn: () => listaFn(),
  });

  const [agendando, setAgendando] = useState<ItemDaFila | null>(null);
  const [quando, setQuando] = useState("");
  const [pauta, setPauta] = useState("");

  type Registro = NonNullable<typeof listaData>["devolutivas"][number];
  const [registrando, setRegistrando] = useState<Registro | null>(null);
  const [duracao, setDuracao] = useState("");
  const [conversa, setConversa] = useState("");
  const [combinados, setCombinados] = useState("");
  const [proxima, setProxima] = useState("");
  const [excluindo, setExcluindo] = useState<Registro | null>(null);
  // Remarcar é caso comum: a devolutiva nasce sem data (agendar já tira da fila)
  // e a data entra depois, quando a pessoa responde o convite.
  const [remarcando, setRemarcando] = useState<Registro | null>(null);
  const [novaData, setNovaData] = useState("");
  // Devolutiva avulsa: acompanhamento não nasce de resultado novo.
  const [avulsa, setAvulsa] = useState(false);
  const [pessoaId, setPessoaId] = useState("");
  const pessoasFn = useServerFn(listarPessoasParaDevolutiva);
  const { data: pessoasData } = useQuery({
    queryKey: ["pessoas-devolutiva"], queryFn: () => pessoasFn(), enabled: avulsa,
  });

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["devolutivas"] });
    qc.invalidateQueries({ queryKey: ["devolutivas-fila"] });
  };

  const agendar = useMutation({
    mutationFn: () =>
      agendarFn({
        data: {
          person_id: agendando!.person_id,
          response_id: agendando!.response_id,
          assessment_id: agendando!.assessment_id,
          scheduled_at: paraIso(quando),
          notes: pauta || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(quando ? "Devolutiva agendada." : "Devolutiva criada, sem data marcada.");
      setAgendando(null); setQuando(""); setPauta("");
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const registrar = useMutation({
    mutationFn: () =>
      registrarFn({
        data: {
          id: registrando!.id,
          duration_min: duracao ? Number(duracao) : null,
          notes: conversa || undefined,
          agreements: combinados || undefined,
          next_at: proxima || null,
        },
      }),
    onSuccess: () => {
      toast.success("Devolutiva registrada.");
      setRegistrando(null); setDuracao(""); setConversa(""); setCombinados(""); setProxima("");
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => atualizarFn({ data: { id, status: "cancelada" } }),
    onSuccess: () => { toast.success("Devolutiva cancelada."); recarregar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remarcar = useMutation({
    mutationFn: () => atualizarFn({ data: { id: remarcando!.id, scheduled_at: paraIso(novaData) } }),
    onSuccess: () => {
      toast.success(novaData ? "Data atualizada." : "Data removida.");
      setRemarcando(null); setNovaData("");
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarAvulsa = useMutation({
    mutationFn: () =>
      agendarFn({
        data: {
          person_id: pessoaId,
          response_id: null,
          assessment_id: null,
          scheduled_at: paraIso(quando),
          notes: pauta || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Devolutiva criada.");
      setAvulsa(false); setPessoaId(""); setQuando(""); setPauta("");
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => { toast.success("Devolutiva excluída."); setExcluindo(null); recarregar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fila = filaData?.fila ?? [];
  const devolutivas = listaData?.devolutivas ?? [];
  const agendadas = useMemo(() => devolutivas.filter((d) => d.status === "agendada"), [devolutivas]);
  const realizadas = useMemo(() => devolutivas.filter((d) => d.status === "realizada"), [devolutivas]);
  const canceladas = useMemo(() => devolutivas.filter((d) => d.status === "cancelada"), [devolutivas]);

  function linkDoResultado(d: { response_id: string | null; assessment_id: string | null }) {
    if (d.assessment_id) return `/relatorio-bateria/${d.assessment_id}`;
    if (d.response_id) return `/relatorio/${d.response_id}`;
    return null;
  }

  return (
    <div className="space-y-8">
      {!groupId && (
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Devolutivas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A conversa em que você apresenta o resultado e monta o plano de ação junto com a pessoa.
          </p>
        </div>
        <Button variant="outline" onClick={() => setAvulsa(true)}>
          <Plus className="size-4" /> Nova devolutiva
        </Button>
      </header>
      )}

      {/* ---------------------------------------------------------- FILA --- */}
      <section className="rounded-xl border border-black/5 bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Esperando devolutiva</h2>
          <p className="text-sm text-muted-foreground">
            {carregandoFila ? "carregando…" : `${fila.length} ${fila.length === 1 ? "pessoa" : "pessoas"}`}
          </p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem concluiu um teste e ainda não teve a conversa. Aparece aqui sozinho, do que espera há mais tempo
          para o mais recente.
        </p>

        {!carregandoFila && fila.length === 0 && (
          <p className="mt-5 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            Ninguém na fila. Assim que alguém concluir um teste, aparece aqui.
          </p>
        )}

        <ul className="mt-5 divide-y divide-black/5">
          {fila.map((item) => (
            <li key={item.assessment_id ?? item.response_id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.person_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.titulo} · concluído em {dataBr(item.concluido_em)}
                </p>
              </div>
              <Espera dias={item.dias_esperando} />
              {linkDoResultado(item) && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={linkDoResultado(item)!} target="_blank" rel="noreferrer">
                    <FileText className="size-3.5" /> Relatório
                  </a>
                </Button>
              )}
              <Button size="sm" onClick={() => setAgendando(item)}>
                <CalendarClock className="size-3.5" /> Agendar
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {/* --------------------------------------------------- AGENDADAS --- */}
      <section className="rounded-xl border border-black/5 bg-card p-5">
        <h2 className="text-lg font-semibold">Agendadas</h2>
        {!carregandoLista && agendadas.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma devolutiva agendada.</p>
        )}
        <ul className="mt-4 divide-y divide-black/5">
          {agendadas.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.person_name}</p>
                <p className={cn("truncate text-xs", d.atrasada ? "font-medium text-red-700" : "text-muted-foreground")}>
                  {dataHoraBr(d.scheduled_at)}
                  {d.atrasada && " · data já passou"}
                </p>
              </div>
              {linkDoResultado(d) && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={linkDoResultado(d)!} target="_blank" rel="noreferrer">
                    <FileText className="size-3.5" /> Relatório
                  </a>
                </Button>
              )}
              <Button size="sm" variant="secondary" asChild>
                <Link to="/devolutivas/$id/painel" params={{ id: d.id }}>
                  <LayoutDashboard className="size-3.5" /> Painel
                </Link>
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => {
                  setRemarcando(d);
                  // `datetime-local` só aceita o formato local sem fuso.
                  setNovaData(d.scheduled_at ? new Date(d.scheduled_at).toISOString().slice(0, 16) : "");
                }}
              >
                <CalendarClock className="size-3.5" /> {d.scheduled_at ? "Remarcar" : "Marcar data"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => cancelar.mutate(d.id)}>Cancelar</Button>
              <Button size="sm" onClick={() => { setRegistrando(d); setConversa(d.notes ?? ""); }}>
                <CheckCircle2 className="size-3.5" /> Registrar
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {/* --------------------------------------------------- REALIZADAS --- */}
      <section className="rounded-xl border border-black/5 bg-card p-5">
        <h2 className="text-lg font-semibold">Realizadas</h2>
        {!carregandoLista && realizadas.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma devolutiva registrada ainda. O que ficar combinado aqui é o que você relê antes do próximo encontro.
          </p>
        )}
        <ul className="mt-4 space-y-4">
          {realizadas.map((d) => (
            <li key={d.id} className="rounded-lg bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.person_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dataBr(d.completed_at)}
                    {d.duration_min ? ` · ${d.duration_min} min` : ""}
                    {d.next_at ? ` · próximo acompanhamento em ${dataBr(d.next_at)}` : ""}
                  </p>
                </div>
                {linkDoResultado(d) && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={linkDoResultado(d)!} target="_blank" rel="noreferrer">
                      <FileText className="size-3.5" /> Relatório
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setExcluindo(d)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              {(d.notes || d.agreements) && (
                <div className="mt-3 space-y-2 border-t border-black/5 pt-3 text-sm">
                  {d.notes && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Conversa: </span>{d.notes}
                    </p>
                  )}
                  {d.agreements && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Combinado: </span>{d.agreements}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {canceladas.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            {canceladas.length} cancelada(s) — a pessoa volta para a fila.
          </p>
        )}
      </section>

      {/* ------------------------------------------------ diálogo agendar --- */}
      <Dialog open={!!agendando} onOpenChange={(v) => !v && setAgendando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar devolutiva</DialogTitle>
            <DialogDescription>
              {agendando?.person_name} · {agendando?.titulo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Quando</label>
              <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className="mt-1.5" />
              <p className="mt-1 text-xs text-muted-foreground">
                Pode deixar em branco: a devolutiva sai da fila e fica como pendente de data.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Pauta (opcional)</label>
              <Textarea
                value={pauta} onChange={(e) => setPauta(e.target.value)} rows={3} className="mt-1.5"
                placeholder="O que você quer abordar. Ex.: o gap entre natural e adaptado, o ponto de atenção em Conformidade…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAgendando(null)}>Cancelar</Button>
            <Button onClick={() => agendar.mutate()} disabled={agendar.isPending}>
              {agendar.isPending ? "Agendando…" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------- diálogo avulso --- */}
      <Dialog open={avulsa} onOpenChange={(v) => !v && setAvulsa(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova devolutiva</DialogTitle>
            <DialogDescription>
              Para conversa de acompanhamento, ou com alguém que você avaliou por fora da plataforma.
              Sem resultado ligado, o painel abre vazio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Com quem</label>
              <select
                value={pessoaId}
                onChange={(e) => setPessoaId(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Escolha uma pessoa…</option>
                {(pessoasData?.pessoas ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Quando</label>
              <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-medium">Pauta (opcional)</label>
              <Textarea value={pauta} onChange={(e) => setPauta(e.target.value)} rows={3} className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAvulsa(false)}>Cancelar</Button>
            <Button onClick={() => criarAvulsa.mutate()} disabled={!pessoaId || criarAvulsa.isPending}>
              {criarAvulsa.isPending ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------ diálogo remarcar --- */}
      <Dialog open={!!remarcando} onOpenChange={(v) => !v && setRemarcando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{remarcando?.scheduled_at ? "Remarcar devolutiva" : "Marcar data"}</DialogTitle>
            <DialogDescription>{remarcando?.person_name}</DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Quando</label>
            <Input
              type="datetime-local" value={novaData}
              onChange={(e) => setNovaData(e.target.value)} className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Deixar em branco tira a data e mantém a devolutiva como pendente de marcar.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemarcando(null)}>Cancelar</Button>
            <Button onClick={() => remarcar.mutate()} disabled={remarcar.isPending}>
              {remarcar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------- diálogo registrar --- */}
      <Dialog open={!!registrando} onOpenChange={(v) => !v && setRegistrando(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar devolutiva</DialogTitle>
            <DialogDescription>{registrando?.person_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">O que foi conversado</label>
              <Textarea value={conversa} onChange={(e) => setConversa(e.target.value)} rows={4} className="mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-medium">O que ficou combinado</label>
              <Textarea
                value={combinados} onChange={(e) => setCombinados(e.target.value)} rows={4} className="mt-1.5"
                placeholder="As ações acordadas. É o que você vai reler antes do próximo encontro."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Duração (min)</label>
                <Input
                  type="number" min={1} max={600} value={duracao}
                  onChange={(e) => setDuracao(e.target.value)} className="mt-1.5" placeholder="60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Próximo acompanhamento</label>
                <Input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} className="mt-1.5" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegistrando(null)}>Cancelar</Button>
            <Button onClick={() => registrar.mutate()} disabled={registrar.isPending}>
              {registrar.isPending ? "Salvando…" : "Marcar como realizada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------- confirmar exclusão --- */}
      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta devolutiva?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro da conversa com {excluindo?.person_name} — incluindo o que ficou combinado — será apagado
              e não tem como recuperar. Se a ideia é só desfazer o agendamento, use <strong>Cancelar</strong>: aí a
              pessoa volta para a fila e o histórico fica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluindo && excluir.mutate(excluindo.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
