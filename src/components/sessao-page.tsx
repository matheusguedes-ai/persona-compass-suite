/**
 * /sessao/$id — o aluno gerencia uma sessão já marcada, sem login (Fatia 4b
 * Parte 2). Cancelar (Passo A) e remarcar (Passo B, reaproveitando o mesmo
 * SeletorDeHorario de /agendar/$slug).
 *
 * O id é o uuid da própria mentoria_sessoes, usado como token — mesmo padrão
 * do slug de /agendar/$slug: segredo o bastante por ser um uuid, sem exigir
 * login. Chega pelo e-mail de confirmação, só quando o link tinha
 * permite_cancelar ou permite_remarcar ligado (ver enviarConfirmacaoEmail em
 * agendamento.functions.ts).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dadosDaSessao, cancelarSessaoAluno, horariosParaRemarcar, remarcarSessaoAluno } from "@/lib/agendamento.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SeletorDeHorario, type Dia } from "@/components/seletor-de-horario";
import { AlertCircle, CalendarClock, CalendarX2, CheckCircle2, Clock, User, XCircle } from "lucide-react";

function Shell({ children, largo = false }: { children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={`mx-auto px-4 py-16 ${largo ? "max-w-2xl" : "max-w-lg"}`}>
      <div className="rounded-xl bg-card p-8 ring-1 ring-black/5">{children}</div>
    </div>
  );
}

function quandoCompleto(iso: string): string {
  const data = new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo",
  });
  const hora = new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const texto = `${data} às ${hora}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function SessaoPage({ id }: { id: string }) {
  const dadosFn = useServerFn(dadosDaSessao);
  const cancelarFn = useServerFn(cancelarSessaoAluno);
  const horariosFn = useServerFn(horariosParaRemarcar);
  const remarcarFn = useServerFn(remarcarSessaoAluno);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["sessao", id],
    queryFn: () => dadosFn({ data: { id } }),
  });

  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [remarcando, setRemarcando] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);

  const cancelar = useMutation({
    mutationFn: () => cancelarFn({ data: { id } }),
    // Sem estado local de "cancelado": invalida e deixa o servidor (fonte da
    // verdade) devolver status:'cancelada' — a página cai sozinha no modo
    // leitura, igual abriria se o aluno voltasse depois.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessao", id] }),
    onError: (e: Error) => setErroAcao(e.message),
  });

  const { data: horariosData, isLoading: carregandoHorarios } = useQuery({
    queryKey: ["sessao-horarios-remarcar", id],
    queryFn: () => horariosFn({ data: { id } }),
    enabled: remarcando,
  });

  const dias: Dia[] = horariosData?.status === "ok" ? horariosData.dias : [];
  const diaAtivo = diaSelecionado ?? dias[0]?.data ?? null;

  function selecionarDia(ymd: string) {
    setDiaSelecionado(ymd);
    setHorarioSelecionado(null);
  }

  function comecarRemarcacao() {
    setErroAcao(null);
    setDiaSelecionado(null);
    setHorarioSelecionado(null);
    setRemarcando(true);
  }

  const remarcar = useMutation({
    mutationFn: () => remarcarFn({ data: { id, quando: horarioSelecionado! } }),
    onSuccess: () => {
      setRemarcando(false);
      qc.invalidateQueries({ queryKey: ["sessao", id] });
    },
    onError: (e: Error) => setErroAcao(e.message),
  });

  if (isLoading) return <Shell><p className="text-center text-sm text-muted-foreground">Carregando…</p></Shell>;

  if (error || !data?.encontrada) {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="mx-auto size-10 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold">Sessão não encontrada</h1>
          <p className="mt-1 text-sm text-muted-foreground">Este endereço não existe ou já não é mais válido.</p>
        </div>
      </Shell>
    );
  }

  const agendada = data.status === "agendada";

  return (
    <Shell largo={remarcando && dias.length > 0}>
      <h1 className="text-xl font-semibold tracking-tight">{data.titulo}</h1>

      <div className="mt-4 space-y-2 text-sm">
        <p className="flex items-center gap-2">
          <Clock className="size-4 shrink-0 text-muted-foreground" /> {quandoCompleto(data.quando)} ({data.duracao_min} min)
        </p>
        <p className="flex items-center gap-2">
          <User className="size-4 shrink-0 text-muted-foreground" /> Com {data.professor}
        </p>
      </div>

      {data.status === "cancelada" && (
        <p className="mt-6 flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          <XCircle className="size-4 shrink-0" /> Esta sessão foi cancelada.
        </p>
      )}
      {data.status === "concluida" && (
        <p className="mt-6 flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0" /> Esta sessão já aconteceu.
        </p>
      )}

      {agendada && !remarcando && (
        <div className="mt-6 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {data.podeRemarcar.sim ? (
              <Button variant="outline" className="w-full" onClick={comecarRemarcacao}>
                <CalendarClock className="size-4" /> Escolher outro horário
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{data.podeRemarcar.motivo}</p>
            )}

            {data.podeCancelar.sim ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full text-destructive hover:text-destructive">
                    <CalendarX2 className="size-4" /> Cancelar sessão
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar esta sessão?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {data.titulo} — {quandoCompleto(data.quando)}. Essa ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelar.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {cancelar.isPending ? "Cancelando…" : "Cancelar sessão"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <p className="text-xs text-muted-foreground">{data.podeCancelar.motivo}</p>
            )}
          </div>

          {erroAcao && (
            <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {erroAcao}
            </p>
          )}
        </div>
      )}

      {agendada && remarcando && (
        <div className="mt-6 space-y-4">
          <p className="text-sm">Escolha o novo horário:</p>

          {carregandoHorarios && <p className="text-sm text-muted-foreground">Buscando horários livres…</p>}

          {!carregandoHorarios && dias.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Não há horários disponíveis no momento. Fale com {data.professor}.
            </p>
          )}

          {dias.length > 0 && diaAtivo && (
            <SeletorDeHorario
              dias={dias}
              diaSelecionado={diaAtivo}
              horarioSelecionado={horarioSelecionado}
              onSelecionarDia={selecionarDia}
              onSelecionarHorario={setHorarioSelecionado}
            />
          )}

          {erroAcao && (
            <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {erroAcao}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setRemarcando(false)} disabled={remarcar.isPending}>
              Voltar
            </Button>
            <Button
              className="flex-1" disabled={!horarioSelecionado || remarcar.isPending}
              onClick={() => remarcar.mutate()}
            >
              {remarcar.isPending ? "Confirmando…" : "Confirmar novo horário"}
            </Button>
          </div>
        </div>
      )}
    </Shell>
  );
}
