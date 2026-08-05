/**
 * /sessao/$id — o aluno gerencia uma sessão já marcada, sem login (Fatia 4b
 * Parte 2). Passo A: só cancelar por enquanto — "Escolher outro horário"
 * chega no Passo B, reaproveitando esta mesma página.
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
import { dadosDaSessao, cancelarSessaoAluno } from "@/lib/agendamento.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertCircle, CalendarX2, CheckCircle2, Clock, User, XCircle } from "lucide-react";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
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
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["sessao", id],
    queryFn: () => dadosFn({ data: { id } }),
  });

  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const cancelar = useMutation({
    mutationFn: () => cancelarFn({ data: { id } }),
    // Sem estado local de "cancelado": invalida e deixa o servidor (fonte da
    // verdade) devolver status:'cancelada' — a página cai sozinha no modo
    // leitura, igual abriria se o aluno voltasse depois.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessao", id] }),
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
    <Shell>
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

      {agendada && (
        <div className="mt-6 space-y-3">
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

          {erroAcao && (
            <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {erroAcao}
            </p>
          )}
        </div>
      )}
    </Shell>
  );
}
