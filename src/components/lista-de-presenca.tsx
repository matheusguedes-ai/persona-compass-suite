/**
 * A lista de presença — as 9 colunas aprovadas, uma aula por vez.
 *
 * Duas coisas nesta tela existem para a lista não mentir, e valem ser ditas:
 *
 * 1. **Fechar a lista.** Enquanto ela está aberta, quem não tem registro
 *    aparece como "sem registro" e a aula não entra na conta da frequência. É o
 *    fechamento que transforma silêncio em afirmação — QR que não subiu, wifi
 *    caído ou uma tela que ninguém abriu não podem virar falta.
 * 2. **O que o professor decidiu à mão aparece marcado**, e dá para voltar ao
 *    cálculo. Sem isso, "atrasado" calculado e "atrasado" digitado ficam
 *    indistinguíveis, e mudar a hora da aula recalcularia só metade da lista.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  tabelaDePresenca, marcarPresencaManual, fecharListaDaAula, presencaParaExportar,
} from "@/lib/classroom.functions";
import { ROTULO_SITUACAO, type Situacao } from "@/lib/presenca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CircleCheck, ClipboardList, Clock, Download, FileSpreadsheet, FileText, Info, Lock,
  LockOpen, MessageSquare, RotateCcw, TriangleAlert, UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COR: Record<Situacao, string> = {
  presente: "text-emerald-700 dark:text-emerald-400",
  atrasado: "text-amber-700 dark:text-amber-400",
  ausente: "text-destructive",
  justificado: "text-sky-700 dark:text-sky-400",
  sem_registro: "text-muted-foreground",
};

export function ListaDePresenca({ treinamentoId }: { treinamentoId: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(tabelaDePresenca);
  const { data, isLoading, error } = useQuery({
    queryKey: ["presenca", treinamentoId],
    queryFn: () => fn({ data: { treinamento_id: treinamentoId } }),
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["presenca", treinamentoId] });

  const [aulaId, setAulaId] = useState<string | null>(null);
  const [aba, setAba] = useState<"aula" | "resumo">("aula");
  const [editando, setEditando] = useState<{ person_id: string; aluno: string } | null>(null);

  const aulas = data?.aulas ?? [];
  const atual = useMemo(
    () => aulas.find((a) => a.id === aulaId) ?? aulas[aulas.length - 1] ?? null,
    [aulas, aulaId],
  );
  const linhas = (data?.linhas ?? []).filter((l) => l.aula_id === atual?.id);

  const fecharFn = useServerFn(fecharListaDaAula);
  const fechar = useMutation({
    mutationFn: (fechar: boolean) => fecharFn({ data: { aula_id: atual!.id, fechar } }),
    onSuccess: (_r, fechou) => {
      inv();
      toast.success(fechou ? "Lista fechada" : "Lista reaberta");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando a lista…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  if (aulas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-card p-10 text-center">
        <ClipboardList className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma aula neste treinamento ainda — sem aula, não há lista de presença.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {([["aula", "Por aula"], ["resumo", "Resumo por aluno"]] as const).map(([v, r]) => (
            <button
              key={v} onClick={() => setAba(v)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium",
                aba === v ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <ExportarPresenca treinamentoId={treinamentoId} titulo={data.treinamento.titulo} />
      </div>

      {aba === "resumo" ? (
        <Resumo resumo={data.resumo} fora={data.fora_da_conta} />
      ) : (
        <>
          {/* Seletor de aula: rolagem horizontal, a mais recente por último. */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {aulas.map((a) => {
              const ativa = a.id === atual?.id;
              return (
                <button
                  key={a.id} onClick={() => setAulaId(a.id)}
                  className={cn(
                    "shrink-0 rounded-lg border px-3 py-2 text-left transition",
                    ativa ? "border-primary bg-primary/5" : "border-black/10 hover:bg-muted/40",
                  )}
                >
                  <p className="text-xs font-medium">{a.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.comeca_em
                      ? new Date(a.comeca_em).toLocaleDateString("pt-BR", {
                          timeZone: "America/Sao_Paulo", day: "2-digit", month: "short",
                        })
                      : "sem data"}
                    {a.cancelada ? " · cancelada" : a.fechada_em ? " · fechada" : " · aberta"}
                  </p>
                </button>
              );
            })}
          </div>

          {atual && (
            <>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg p-3 text-xs",
                  atual.fechada_em
                    ? "bg-muted/60 text-muted-foreground"
                    : "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
                )}
              >
                {atual.fechada_em ? (
                  <>
                    <Lock className="size-3.5 shrink-0" />
                    <span>
                      Lista fechada em{" "}
                      {new Date(atual.fechada_em).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      . As ausências desta aula estão afirmadas e ela entra na conta da frequência.
                    </span>
                    <Button
                      variant="ghost" size="sm" className="ml-auto text-xs"
                      disabled={fechar.isPending}
                      onClick={() => fechar.mutate(false)}
                    >
                      <LockOpen className="size-3" /> reabrir
                    </Button>
                  </>
                ) : (
                  <>
                    <TriangleAlert className="size-3.5 shrink-0" />
                    <span>
                      <strong>Lista ainda não fechada.</strong> Quem não tem registro aparece como
                      “sem registro”, não como ausente — e esta aula ainda não entra na conta da
                      frequência. Feche quando a chamada estiver conferida.
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" className="ml-auto text-xs" disabled={fechar.isPending}>
                          <Lock className="size-3" /> Fechar a lista
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Fechar a lista desta aula?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A partir daqui, quem não tem registro passa a constar como{" "}
                            <strong>ausente</strong> — inclusive na planilha que vai para o RH. Dá
                            para reabrir depois, se você achar um erro.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => fechar.mutate(true)}>
                            Fechar a lista
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl ring-1 ring-black/5">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="p-2.5 font-medium">Aluno</th>
                      <th className="p-2.5 font-medium">Grupo</th>
                      <th className="p-2.5 font-medium">Chegada</th>
                      <th className="p-2.5 font-medium">Como foi registrada</th>
                      <th className="p-2.5 font-medium">Atraso</th>
                      <th className="p-2.5 font-medium">Situação</th>
                      <th className="p-2.5 font-medium">Frequência até esta aula</th>
                      <th className="p-2.5 font-medium">Observação</th>
                      <th className="p-2.5 font-medium">Quem tocou nesta linha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {linhas.map((l) => (
                      <tr key={l.person_id} className="align-top">
                        <td className="p-2.5">
                          <p className="font-medium">{l.aluno}</p>
                          {l.saiu_do_grupo && (
                            <p className="text-[11px] text-muted-foreground">não está mais na turma</p>
                          )}
                        </td>
                        <td className="p-2.5 text-muted-foreground">{l.grupo ?? "—"}</td>
                        <td className="p-2.5 tabular-nums text-muted-foreground">{l.chegada || "—"}</td>
                        <td className="p-2.5 text-muted-foreground">{l.origem || "—"}</td>
                        <td className="p-2.5 tabular-nums text-muted-foreground">{l.atraso_texto || "—"}</td>
                        <td className="p-2.5">
                          <span className={cn("font-medium", COR[l.situacao])}>
                            {l.situacao_rotulo}
                          </span>
                          {l.override && (
                            <span className="block text-[11px] text-muted-foreground">
                              definido por você
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 tabular-nums">
                          {l.frequencia}
                          {l.frequencia_pct != null && (
                            <span className="text-[11px] text-muted-foreground"> · {l.frequencia_pct}%</span>
                          )}
                        </td>
                        <td className="max-w-[220px] p-2.5 text-muted-foreground">
                          {l.observacao || "—"}
                        </td>
                        <td className="p-2.5 text-muted-foreground">{l.quem ?? "—"}</td>
                        <td className="p-2.5 text-right">
                          <Button
                            variant="ghost" size="sm" className="text-[11px]"
                            onClick={() => setEditando({ person_id: l.person_id, aluno: l.aluno })}
                          >
                            ajustar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Legenda tolerancia={data.tolerancia_min} />
            </>
          )}
        </>
      )}

      {editando && atual && (
        <AjustarLinha
          aulaId={atual.id}
          linha={linhas.find((l) => l.person_id === editando.person_id)!}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); inv(); }}
        />
      )}
    </div>
  );
}

function Legenda({ tolerancia }: { tolerancia: number }) {
  return (
    <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <p className="flex items-start gap-1.5">
        <Clock className="mt-0.5 size-3 shrink-0" />
        <span>
          <strong>Atrasado a partir de {tolerancia} min</strong>, contando da hora do check-in
          (segundos desprezados). Presença marcada à mão não tem hora de chegada, então não tem
          atraso — aparece “—”.
        </span>
      </p>
      <p className="flex items-start gap-1.5">
        <Info className="mt-0.5 size-3 shrink-0" />
        <span>
          A frequência conta as aulas <strong>já realizadas e com lista fechada</strong>, não o
          total do treinamento. <strong>Falta justificada não conta como presença.</strong>
        </span>
      </p>
      <p className="flex items-start gap-1.5">
        <MessageSquare className="mt-0.5 size-3 shrink-0" />
        <span>
          Os horários registram a <strong>confirmação de chegada, não permanência</strong> na sala.
          Registro pelo professor é o caminho previsto para quem não tem celular, senha ou sinal.
        </span>
      </p>
    </div>
  );
}

function Resumo({
  resumo, fora,
}: {
  resumo: Array<{
    person_id: string; aluno: string; grupo: string | null; presentes: number; contadas: number;
    justificadas: number; pct: number | null; saiu_do_grupo: boolean;
  }>;
  fora: Array<{ titulo: string; motivo: string }>;
}) {
  return (
    <div className="space-y-3">
      {fora.length > 0 && (
        <p className="rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
          Fora da conta da frequência:{" "}
          {fora.map((f) => `${f.titulo} (${f.motivo})`).join(" · ")}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl ring-1 ring-black/5">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2.5 font-medium">Aluno</th>
              <th className="p-2.5 font-medium">Grupo</th>
              <th className="p-2.5 font-medium">Frequência</th>
              <th className="p-2.5 font-medium">Justificadas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {resumo.map((r) => (
              <tr key={r.person_id}>
                <td className="p-2.5">
                  <p className="font-medium">{r.aluno}</p>
                  {r.saiu_do_grupo && (
                    <p className="text-[11px] text-muted-foreground">não está mais na turma</p>
                  )}
                </td>
                <td className="p-2.5 text-muted-foreground">{r.grupo ?? "—"}</td>
                <td className="p-2.5 tabular-nums">
                  {r.contadas === 0 ? "—" : `${r.presentes} de ${r.contadas}`}
                  {r.pct != null && (
                    <span className="text-[11px] text-muted-foreground"> · {r.pct}%</span>
                  )}
                </td>
                <td className="p-2.5 tabular-nums text-muted-foreground">
                  {r.justificadas === 0 ? "—" : r.justificadas}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AjustarLinha({
  aulaId, linha, onFechar, onSalvo,
}: {
  aulaId: string;
  linha: {
    person_id: string; aluno: string; situacao: Situacao; observacao: string | null;
    override: boolean; tem_registro: boolean; chegada: string;
  };
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [situacao, setSituacao] = useState<Situacao | "calculado">(
    linha.override ? linha.situacao : "calculado",
  );
  const [observacao, setObservacao] = useState(linha.observacao ?? "");

  const fn = useServerFn(marcarPresencaManual);
  const salvar = useMutation({
    mutationFn: () =>
      fn({
        data: {
          aula_id: aulaId,
          person_id: linha.person_id,
          situacao: situacao === "calculado" ? null : (situacao as "presente" | "atrasado" | "ausente" | "justificado"),
          observacao: observacao.trim() || null,
        },
      }),
    onSuccess: () => { toast.success("Linha ajustada"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // O motivo é obrigatório justamente nas duas decisões mais contestáveis: negar
  // presença de quem escaneou, e transformar falta em justificada. É o texto que
  // vai junto para o RH — sem ele a linha só afirma, não explica.
  const exigeMotivo =
    (situacao === "ausente" && linha.tem_registro) || situacao === "justificado";
  const faltaMotivo = exigeMotivo && observacao.trim().length < 3;

  const OPCOES: Array<[Situacao | "calculado", string]> = [
    ["calculado", "Pelo cálculo"],
    ["presente", ROTULO_SITUACAO.presente],
    ["atrasado", ROTULO_SITUACAO.atrasado],
    ["ausente", ROTULO_SITUACAO.ausente],
    ["justificado", ROTULO_SITUACAO.justificado],
  ];

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{linha.aluno}</DialogTitle>
          <DialogDescription>
            {linha.tem_registro
              ? `Chegada registrada: ${linha.chegada}`
              : "Sem check-in nesta aula."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Situação</Label>
            <div className="flex flex-wrap gap-2">
              {OPCOES.map(([v, r]) => (
                <button
                  key={v} type="button" onClick={() => setSituacao(v)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs transition",
                    situacao === v
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {situacao === "calculado"
                ? "A situação sai do horário do check-in — é o padrão, e acompanha mudanças na hora da aula."
                : "Você está definindo à mão. A linha vai aparecer marcada como sua decisão."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea
              value={observacao} onChange={(e) => setObservacao(e.target.value)}
              rows={3} maxLength={500}
              placeholder={exigeMotivo ? "Escreva o motivo — este texto vai para o RH" : "Ex.: saiu mais cedo"}
            />
            <p className="text-[11px] text-muted-foreground">
              Isto <strong>circula na lista</strong>: aparece na planilha que vai para o RH e para o
              cliente. Anotação só sua vive nas anotações da aula.
            </p>
          </div>

          {situacao === "ausente" && linha.tem_registro && (
            <p className="rounded-lg bg-muted/60 p-3 text-[11px] text-muted-foreground">
              Atenção: esta pessoa <strong>confirmou presença pelo QR</strong> ({linha.chegada}) e
              você está marcando ausente. O check-in continua registrado na lista — os dois fatos
              aparecem.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {linha.override ? (
            <Button
              variant="ghost" className="text-xs"
              onClick={() => { setSituacao("calculado"); }}
            >
              <RotateCcw className="size-3.5" /> voltar ao calculado
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            {faltaMotivo && (
              <span className="text-[11px] text-muted-foreground">escreva o motivo</span>
            )}
            <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || faltaMotivo}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Escapa o que vai para o HTML da impressão: observação é texto livre. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function ExportarPresenca({ treinamentoId, titulo }: { treinamentoId: string; titulo: string }) {
  const fn = useServerFn(presencaParaExportar);
  const [formato, setFormato] = useState<"xlsx" | "pdf">("xlsx");
  const [aberto, setAberto] = useState(false);

  const exportar = useMutation({
    mutationFn: async () => {
      const r = await fn({ data: { treinamento_id: treinamentoId } });
      if (r.linhas.length === 0) throw new Error("Nada para exportar ainda.");
      const nome = `presenca-${titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${new Date()
        .toISOString().slice(0, 10)}`;

      if (formato === "xlsx") {
        const XLSX = await import("xlsx");
        const livro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(r.linhas), "Presença");
        XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(r.resumo), "Resumo por aluno");
        // O rodapé vai numa aba própria: é o que explica os números quando o
        // arquivo estiver longe da tela, na caixa de e-mail de alguém.
        XLSX.utils.book_append_sheet(
          livro,
          XLSX.utils.aoa_to_sheet(r.rodape.split("\n").map((l) => [l])),
          "Como ler",
        );
        const buf = XLSX.write(livro, { bookType: "xlsx", type: "array" });
        const url = URL.createObjectURL(
          new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        );
        const a = document.createElement("a");
        a.href = url; a.download = `${nome}.xlsx`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const cols = Object.keys(r.linhas[0]);
        const html = `<!doctype html><meta charset="utf-8"><title>${esc(r.titulo)}</title>
<style>
 body{font:11px system-ui;padding:20px;color:#111}
 h1{font-size:16px;margin:0 0 2px}
 pre.rodape{color:#555;font-size:10px;margin:0 0 14px;white-space:pre-wrap;font-family:inherit}
 table{border-collapse:collapse;width:100%}
 th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}
 th{background:#f4f4f5}
 @media print{@page{size:landscape;margin:10mm}}
</style>
<h1>Lista de presença — ${esc(r.titulo)}</h1>
<pre class="rodape">${esc(r.rodape)}</pre>
<table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>
${r.linhas.map((l) => `<tr>${cols.map((c) => `<td>${esc((l as Record<string, unknown>)[c])}</td>`).join("")}</tr>`).join("")}
</tbody></table>`;
        const w = window.open("", "_blank");
        if (!w) throw new Error("O navegador bloqueou a janela. Libere os pop-ups e tente de novo.");
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
      }
      return r.linhas.length;
    },
    onSuccess: (n) => { toast.success(`${n} linhas exportadas.`); setAberto(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <Button variant="outline" size="sm" className="ml-auto" onClick={() => setAberto(true)}>
        <Download className="size-4" /> Exportar lista
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar a lista de presença</DialogTitle>
          <DialogDescription>
            Sai uma linha por aluno por aula, com as mesmas colunas da tela — mais uma aba de
            resumo e outra explicando como ler os números. Resultado de teste e perfil{" "}
            <strong>não</strong> vão no arquivo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button
            variant={formato === "xlsx" ? "default" : "outline"} size="sm"
            onClick={() => setFormato("xlsx")}
          >
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
          <Button
            variant={formato === "pdf" ? "default" : "outline"} size="sm"
            onClick={() => setFormato("pdf")}
          >
            <FileText className="size-4" /> PDF
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => exportar.mutate()} disabled={exportar.isPending}>
            {exportar.isPending ? "Preparando…" : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
