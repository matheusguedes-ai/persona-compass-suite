/**
 * #301 — Detalhe de uma campanha.
 *
 * Onde a campanha vira gente: quem já respondeu, quem falta, o link pra
 * compartilhar, e o formulário pra escolher mais gente da lista (o que antes
 * acontecia todo dentro do assistente "Novo envio" — aqui ele mora junto do
 * resultado, não separado dele).
 */
import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPeople } from "@/lib/data.functions";
import { getEmailStatus, sendMentorEmail } from "@/lib/email.functions";
import { baixarPlanilhaDeRespostas } from "@/lib/exportar-respostas.functions";
import { baixarArquivo } from "@/lib/baixar-arquivo";
import { baixarPdf } from "@/lib/baixar-pdf";
import {
  getCampanha, setInviteLinkActive, startResponse, startAssessment,
  setResponseCanceled, setAssessmentCanceled, deleteResponse, deleteAssessment,
} from "@/lib/tests.functions";
import { AcoesDoEnvio } from "@/components/acoes-do-envio";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Copy, FileText, Lock, Mail, Plus, RotateCcw, Send, Download, FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

const MARCAS_DIACRITICAS = /[̀-ͯ]/g;
function slugify(texto: string): string {
  return texto.normalize("NFD").replace(MARCAS_DIACRITICAS, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "campanha";
}

export const Route = createFileRoute("/_app/envios/$campanhaId")({
  head: () => ({
    meta: [{ title: "Campanha — Métrica Humana" }],
  }),
  component: DetalheCampanha,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  submitted: "Concluído",
  expired: "Expirado",
};

function DetalheCampanha() {
  const { campanhaId } = Route.useParams();
  const qc = useQueryClient();

  const getCampanhaFn = useServerFn(getCampanha);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["campanha", campanhaId],
    queryFn: () => getCampanhaFn({ data: { id: campanhaId } }),
  });

  const recarregar = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["campanhas"] });
  };

  const setActiveFn = useServerFn(setInviteLinkActive);
  const encerrarReabrir = useMutation({
    mutationFn: (is_active: boolean) => setActiveFn({ data: { id: campanhaId, is_active } }),
    onSuccess: (_d, is_active) => {
      recarregar();
      toast.success(is_active ? "Campanha reaberta" : "Campanha encerrada — o link parou de aceitar gente nova");
    },
    onError: (e: unknown) => toast.error(mensagemDeErro(e)),
  });

  // ---- Envio por email para gente da lista ----
  const [enviarAberto, setEnviarAberto] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [enviarPorEmail, setEnviarPorEmail] = useState(true);

  const listPeopleFn = useServerFn(listPeople);
  const { data: people = [] } = useQuery({
    queryKey: ["people"], queryFn: () => listPeopleFn(), enabled: enviarAberto,
  });
  const emailStatusFn = useServerFn(getEmailStatus);
  const { data: emailStatus } = useQuery({ queryKey: ["email-status"], queryFn: () => emailStatusFn() });
  const enviarEmailFn = useServerFn(sendMentorEmail);
  const startFn = useServerFn(startResponse);
  const startAssessmentFn = useServerFn(startAssessment);

  const jaConvidados = useMemo(
    () => new Set((data?.recipientes ?? []).map((r) => r.person_id).filter((id): id is string => !!id)),
    [data],
  );

  const toggle = (id: string) =>
    setSelecionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const enviar = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Campanha não carregada.");
      const versionIds = data.campanha.version_ids;
      const useBateria = versionIds.length > 1;
      const results: { id: string; battery: boolean; person_id: string }[] = [];
      // O banco devolve timestamptz com offset ("+00:00"), e o schema de
      // startResponse/startAssessment exige ISO estrito com "Z" — sem
      // reformatar, todo envio de campanha com prazo cai fora do formato.
      const expiresIso = data.campanha.expires_at ? new Date(data.campanha.expires_at).toISOString() : null;
      for (const person_id of selecionadas) {
        if (useBateria) {
          const row = await startAssessmentFn({
            data: { person_id, version_ids: versionIds, invite_link_id: campanhaId, expires_at: expiresIso },
          });
          results.push({ id: row.id, battery: true, person_id });
        } else {
          const row = await startFn({
            data: { version_id: versionIds[0], person_id, invite_link_id: campanhaId, expires_at: expiresIso },
          });
          results.push({ id: row.id, battery: false, person_id });
        }
      }
      let enviados = 0;
      if (emailStatus?.ativo && enviarPorEmail) {
        for (const r of results) {
          const pessoa = people.find((p) => p.id === r.person_id);
          if (!pessoa?.email) continue;
          try {
            await enviarEmailFn({
              data: {
                kind: "convite",
                response_id: r.battery ? null : r.id,
                assessment_id: r.battery ? r.id : null,
                origin: window.location.origin,
              },
            });
            enviados++;
          } catch {
            // O link já existe mesmo se o email falhar — dá pra copiar e mandar na mão pela lista.
          }
        }
      }
      return { total: results.length, enviados };
    },
    onSuccess: ({ total, enviados }) => {
      recarregar();
      setSelecionadas([]);
      setEnviarAberto(false);
      if (enviarPorEmail && emailStatus?.ativo) {
        toast.success(`${total} envio(s) criados — ${enviados} email(s) enviados`);
      } else {
        toast.success(`${total} envio(s) criados`);
      }
    },
    onError: (e: unknown) => toast.error(mensagemDeErro(e, undefined, "Falha ao enviar")),
  });

  // ---- Cancelar / excluir cada recipiente ----
  const cancelarRespostaFn = useServerFn(setResponseCanceled);
  const cancelarBateriaFn = useServerFn(setAssessmentCanceled);
  const excluirRespostaFn = useServerFn(deleteResponse);
  const excluirBateriaFn = useServerFn(deleteAssessment);
  const cancelarResposta = useMutation({
    mutationFn: (v: { id: string; canceled: boolean }) => cancelarRespostaFn({ data: v }),
    onSuccess: (_d, v) => { recarregar(); toast.success(v.canceled ? "Envio cancelado — o link parou de funcionar" : "Envio reativado"); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });
  const cancelarBateria = useMutation({
    mutationFn: (v: { id: string; canceled: boolean }) => cancelarBateriaFn({ data: v }),
    onSuccess: (_d, v) => { recarregar(); toast.success(v.canceled ? "Bateria cancelada — os links pararam de funcionar" : "Bateria reativada"); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });
  const excluirResposta = useMutation({
    mutationFn: (id: string) => excluirRespostaFn({ data: { id } }),
    onSuccess: () => { recarregar(); toast.success("Envio excluído"); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });
  const excluirBateria = useMutation({
    mutationFn: (id: string) => excluirBateriaFn({ data: { id } }),
    onSuccess: () => { recarregar(); toast.success("Bateria excluída"); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  // ---- Exportar a campanha inteira em planilha (reaproveita a #280) ----
  const planilhaFn = useServerFn(baixarPlanilhaDeRespostas);
  const exportar = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Campanha não carregada.");
      const XLSX = await import("xlsx");
      const livro = XLSX.utils.book_new();
      const usados = new Set<string>();
      let totalLinhas = 0;
      let semDados = 0;
      for (const versionId of data.campanha.version_ids) {
        let r: Awaited<ReturnType<typeof planilhaFn>>;
        try {
          r = await planilhaFn({ data: { version_id: versionId, invite_link_id: campanhaId } });
        } catch {
          // Teste desta campanha ainda sem resposta suficiente (vazio, ou
          // anônimo com menos de 3) — pula a aba dele, não aborta o resto.
          semDados++;
          continue;
        }
        const aba = XLSX.utils.json_to_sheet(r.linhas);
        const limpo = r.titulo.replace(/[:\\/?*[\]]/g, "").trim() || "Respostas";
        let nomeAba = limpo.slice(0, 31);
        let n = 2;
        while (usados.has(nomeAba)) nomeAba = `${limpo.slice(0, 28)} (${n++})`;
        usados.add(nomeAba);
        XLSX.utils.book_append_sheet(livro, aba, nomeAba);
        totalLinhas += r.linhas.length;
      }
      if (usados.size === 0) throw new Error("Nenhum teste desta campanha tem resposta suficiente para exportar ainda.");
      const buf = XLSX.write(livro, { bookType: "xlsx", type: "array" });
      baixarArquivo(
        `campanha-${slugify(data.campanha.title ?? "campanha")}.xlsx`,
        new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      return { totalLinhas, planilhas: usados.size, semDados };
    },
    onSuccess: ({ totalLinhas, planilhas, semDados }) => {
      const plural = totalLinhas === 1 ? "resposta" : "respostas";
      toast.success(
        `${totalLinhas} ${plural} em ${planilhas} planilha(s)` +
        (semDados > 0 ? ` — ${semDados} teste(s) ainda sem dado suficiente` : ""),
      );
    },
    onError: (e: unknown) => toast.error(mensagemDeErro(e, undefined, "Falha ao gerar a planilha")),
  });

  const copiarLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/convite/${campanhaId}`);
    toast.success("Link copiado");
  };
  const copiarLinkEnvio = (id: string, kind: "responder" | "bateria") => {
    navigator.clipboard.writeText(`${window.location.origin}/${kind}/${id}`);
    toast.success("Link copiado");
  };

  if (isLoading) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>;
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Link to="/envios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Voltar
        </Link>
        <p className="text-sm text-muted-foreground">Campanha não encontrada.</p>
      </div>
    );
  }

  const { campanha, recipientes, total, respondidos } = data;
  const naoComecou = !!campanha.starts_at && new Date(campanha.starts_at).getTime() > Date.now();
  const expirada = !!campanha.expires_at && new Date(campanha.expires_at).getTime() < Date.now();
  const status = !campanha.is_active ? "Encerrada" : expirada ? "Expirada" : naoComecou ? "Agendada" : "Ativa";
  const useBateria = campanha.version_ids.length > 1;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/envios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Voltar para Campanhas
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{campanha.title}</h1>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-black/5 ${
                status === "Ativa" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" :
                status === "Agendada" ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" :
                "bg-muted text-muted-foreground"
              }`}>{status}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {campanha.testes.join(", ") || "—"}
              {campanha.groups?.name && ` · Grupo: ${campanha.groups.name}`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {campanha.starts_at && `De ${new Date(campanha.starts_at).toLocaleString("pt-BR")} `}
              {campanha.expires_at && `até ${new Date(campanha.expires_at).toLocaleString("pt-BR")}`}
              {!campanha.starts_at && !campanha.expires_at && "Sem prazo"}
              {campanha.max_responses != null && ` · limite de ${campanha.max_responses} resposta(s)`}
            </p>
          </div>
          <Button
            variant={campanha.is_active ? "outline" : "default"}
            onClick={() => encerrarReabrir.mutate(!campanha.is_active)}
            disabled={encerrarReabrir.isPending}
          >
            {campanha.is_active ? <><Lock className="size-4" /> Encerrar campanha</> : <><RotateCcw className="size-4" /> Reabrir campanha</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-black/5">
          <div className="text-2xl font-semibold">{total}</div>
          <div className="text-xs text-muted-foreground">total</div>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-black/5">
          <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{respondidos}</div>
          <div className="text-xs text-muted-foreground">respondido</div>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-black/5">
          <div className="text-2xl font-semibold text-amber-600 dark:text-amber-400">{total - respondidos}</div>
          <div className="text-xs text-muted-foreground">pendente</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-black/5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground">Link para compartilhar</div>
          <div className="truncate text-sm">{typeof window !== "undefined" ? window.location.origin : ""}/convite/{campanhaId}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copiarLink}>
            <Copy className="size-3.5" /> Copiar link
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportar.mutate()} disabled={exportar.isPending || respondidos === 0}>
            <FileSpreadsheet className="size-3.5" /> {exportar.isPending ? "Gerando…" : "Exportar planilha"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-black/5">
        {!enviarAberto ? (
          <Button variant="outline" onClick={() => setEnviarAberto(true)}>
            <Plus className="size-4" /> Enviar para alguém da lista
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Escolha quem recebe</Label>
              <Button variant="ghost" size="sm" onClick={() => { setEnviarAberto(false); setSelecionadas([]); }}>Fechar</Button>
            </div>
            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma pessoa cadastrada. Vá em <Link to="/pessoas" className="underline">Pessoas</Link> para adicionar.
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-auto rounded-lg ring-1 ring-black/5">
                {people.map((p) => {
                  const on = selecionadas.includes(p.id);
                  const jaTem = jaConvidados.has(p.id);
                  return (
                    <label key={p.id} className={`flex cursor-pointer items-center gap-3 p-3 transition-colors ${
                      on ? "bg-accent/10" : "hover:bg-muted/40"
                    }`}>
                      <Checkbox checked={on} onCheckedChange={() => toggle(p.id)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </div>
                      {jaTem && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">já está na campanha</span>}
                    </label>
                  );
                })}
              </div>
            )}
            {emailStatus?.ativo && (
              <div className="flex items-center gap-2">
                <Switch id="enviarEmail" checked={enviarPorEmail} onCheckedChange={setEnviarPorEmail} />
                <Label htmlFor="enviarEmail" className="text-sm">Mandar o convite por email agora</Label>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => enviar.mutate()} disabled={selecionadas.length === 0 || enviar.isPending}>
                <Send className="size-4" /> {enviar.isPending ? "Enviando…" : `Enviar (${selecionadas.length})`}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-black/5">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-black/5 bg-muted/50">
            <tr>
              <th className="px-6 py-3 font-medium text-muted-foreground">Avaliado</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Criado em</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {recipientes.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-muted-foreground">Ninguém recebeu esta campanha ainda.</td></tr>
            )}
            {recipientes.map((r) => {
              const bateria = r.tipo === "bateria";
              const complete = r.status === "submitted";
              return (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-6 py-4 font-medium">{r.people?.full_name ?? "—"}{bateria && <span className="ml-2 text-xs font-normal text-muted-foreground">bateria</span>}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {r.canceled_at
                      ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Cancelado</span>
                      : (STATUS_LABEL[r.status] ?? r.status)}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-6 py-4 text-right">
                    {complete && (
                      <>
                        <Button variant="ghost" size="sm" asChild>
                          {bateria ? (
                            <Link to="/relatorio-bateria/$assessmentId" params={{ assessmentId: r.id }}>
                              <FileText className="size-3" /> Relatório
                            </Link>
                          ) : (
                            <Link to="/relatorio/$responseId" params={{ responseId: r.id }}>
                              <FileText className="size-3" /> Relatório
                            </Link>
                          )}
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => baixarPdf(
                            bateria ? `/api/pdf/bateria/${r.id}` : `/api/pdf/relatorio/${r.id}`,
                            bateria ? "relatorio-da-bateria" : "relatorio",
                          )}
                        >
                          <Download className="size-3" /> PDF
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => copiarLinkEnvio(r.id, bateria ? "bateria" : "responder")}>
                      <Copy className="size-3" /> Link
                    </Button>
                    <AcoesDoEnvio
                      nome={r.people?.full_name ?? "este avaliado"}
                      respondido={complete}
                      cancelado={!!r.canceled_at}
                      bateria={bateria}
                      onCancelar={(c) => (bateria ? cancelarBateria : cancelarResposta).mutate({ id: r.id, canceled: c })}
                      onExcluir={() => (bateria ? excluirBateria : excluirResposta).mutate(r.id)}
                      ocupado={cancelarResposta.isPending || excluirResposta.isPending || cancelarBateria.isPending || excluirBateria.isPending}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!emailStatus?.ativo && enviarAberto && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="size-3.5" /> Envio de email ainda não está ligado nesta conta — os links são criados e você copia manualmente.
        </p>
      )}
    </div>
  );
}
