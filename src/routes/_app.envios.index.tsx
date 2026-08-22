import { mensagemDeErro } from "@/lib/erro-legivel";
import { AbasDeTestes } from "@/components/abas-testes";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listResponses, listAssessments, createObserverInvite, listInviteLinks, setInviteLinkActive,
  setResponseCanceled, setAssessmentCanceled, deleteResponse, deleteAssessment,
} from "@/lib/tests.functions";
import { AcoesDoEnvio } from "@/components/acoes-do-envio";
import { Button } from "@/components/ui/button";
import { Copy, FileText, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/envios/")({
  head: () => ({
    meta: [
      { title: "Envios — Métrica Humana" },
      { name: "description", content: "Histórico completo de testes disparados." },
      { property: "og:title", content: "Envios — Métrica Humana" },
      { property: "og:description", content: "Histórico completo de testes disparados." },
    ],
  }),
  component: EnviosPage,
});

type ResponseRow = {
  id: string;
  status: string;
  canceled_at?: string | null;
  created_at: string;
  observers_invited?: number;
  observers_answered?: number;
  /** O teste aceita 360°? Só os de escolha forçada. Ver listEnvios. */
  aceita_observador?: boolean;
  people: { id: string; full_name: string; email: string } | null;
  test_versions: { id: string; title: string; instrument_id: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  submitted: "Concluído",
  expired: "Expirado",
};

type AssessmentRow = {
  id: string;
  status: string;
  canceled_at?: string | null;
  created_at: string;
  total: number;
  done: number;
  people: { id: string; full_name: string; email: string } | null;
  parts: { response_id: string; title: string; instrument_id: string | null; submitted: boolean }[];
};

function EnviosPage() {
  const listFn = useServerFn(listResponses);
  const listAssessmentsFn = useServerFn(listAssessments);
  const inviteFn = useServerFn(createObserverInvite);
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["responses"],
    queryFn: () => listFn({ data: {} }) as Promise<ResponseRow[]>,
  });

  const listInviteLinksFn = useServerFn(listInviteLinks);
  const setInviteLinkActiveFn = useServerFn(setInviteLinkActive);
  const qc = useQueryClient();
  const { data: inviteLinks = [] } = useQuery({
    queryKey: ["invite-links"],
    queryFn: () => listInviteLinksFn(),
  });
  const toggleLink = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => setInviteLinkActiveFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invite-links"] }); toast.success("Link atualizado"); },
    onError: (e: unknown) => toast.error(mensagemDeErro(e, undefined, "Falha ao atualizar")),
  });
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const cancelarRespostaFn = useServerFn(setResponseCanceled);
  const cancelarBateriaFn = useServerFn(setAssessmentCanceled);
  const excluirRespostaFn = useServerFn(deleteResponse);
  const excluirBateriaFn = useServerFn(deleteAssessment);
  const recarregar = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["assessments"] });
  };
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

  const { data: batteries = [] } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => listAssessmentsFn({ data: {} }) as Promise<AssessmentRow[]>,
  });

  const copyLink = (id: string, kind: "responder" | "bateria" = "responder") => {
    navigator.clipboard.writeText(`${window.location.origin}/${kind}/${id}`);
    toast.success("Link copiado");
  };

  const inviteObserver = async (id: string) => {
    try {
      const res = await inviteFn({ data: { response_id: id } });
      const link = `${window.location.origin}/responder/${res.id}`;
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success("Link do observador copiado");
      refetch();
    } catch (e) {
      toast.error(mensagemDeErro(e, undefined, "Não foi possível criar o convite"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Envios</h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.length + batteries.length} disparos registrados.</p>
        </div>

      <AbasDeTestes />
        <Button asChild><Link to="/envios/novo" search={{ personId: undefined, groupId: undefined }}><Plus className="size-4" /> Novo envio</Link></Button>
      </div>

      {inviteLinks.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
          <div className="border-b border-black/5 bg-muted/50 px-6 py-3">
            <p className="text-sm font-medium">Links abertos</p>
            <p className="text-xs text-muted-foreground">Um link para vários respondentes — cada pessoa se identifica ao abrir.</p>
          </div>
          <ul className="divide-y divide-black/5">
            {inviteLinks.map((l) => {
              const expired = !!l.expires_at && new Date(l.expires_at).getTime() < Date.now();
              const full = l.max_responses != null && l.response_count >= l.max_responses;
              const status = !l.is_active ? "Desativado" : expired ? "Expirado" : full ? "Esgotado" : "Ativo";
              const url = `${origin}/convite/${l.id}`;
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {l.title || `${l.version_ids.length} ${l.version_ids.length === 1 ? "teste" : "testes"}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{url}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {l.response_count} {l.response_count === 1 ? "resposta" : "respostas"}
                      {l.max_responses != null && ` de ${l.max_responses}`}
                      {l.expires_at && ` · até ${new Date(l.expires_at).toLocaleString("pt-BR")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-black/5 ${
                      status === "Ativo" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
                    }`}>{status}</span>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
                      <Copy className="size-3" /> Copiar
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => toggleLink.mutate({ id: l.id, is_active: !l.is_active })}
                      disabled={toggleLink.isPending}
                    >
                      {l.is_active ? "Desativar" : "Reativar"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-muted/50">
            <tr>
              <th className="px-6 py-3 font-medium text-muted-foreground">Avaliado</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Teste</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Observadores</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Criado em</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {batteries.map((b) => {
              const complete = b.done === b.total && b.total > 0;
              return (
                <tr key={b.id} className="hover:bg-muted/40">
                  <td className="px-6 py-4 font-medium">{b.people?.full_name ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">Bateria — {b.total} testes</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {b.canceled_at ? "Cancelado" : complete ? "Concluído" : `${b.done}/${b.total} respondidos`}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">—</td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(b.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-6 py-4 text-right">
                    {b.done > 0 && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/relatorio-bateria/$assessmentId" params={{ assessmentId: b.id }}>
                          <FileText className="size-3" /> Relatório{complete ? "" : " parcial"}
                        </Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => copyLink(b.id, "bateria")}>
                      <Copy className="size-3" /> Link
                    </Button>
                    <AcoesDoEnvio
                      nome={b.people?.full_name ?? "este avaliado"}
                      respondido={b.status === "submitted"}
                      cancelado={!!b.canceled_at}
                      bateria
                      onCancelar={(c) => cancelarBateria.mutate({ id: b.id, canceled: c })}
                      onExcluir={() => excluirBateria.mutate(b.id)}
                      ocupado={cancelarBateria.isPending || excluirBateria.isPending}
                    />
                  </td>
                </tr>
              );
            })}
            {data.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-6 py-4 font-medium">{r.people?.full_name ?? "—"}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.test_versions?.title ?? "—"}</td>
                <td className="px-6 py-4 text-muted-foreground">
                  {r.canceled_at
                    ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Cancelado</span>
                    : (STATUS_LABEL[r.status] ?? r.status)}
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {(r.observers_invited ?? 0) === 0
                    ? "—"
                    : `${r.observers_answered ?? 0} de ${r.observers_invited} respondido(s)`}
                </td>
                <td className="px-6 py-4 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-6 py-4 text-right">
                  {r.status === "submitted" && (
                    <>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/relatorio/$responseId" params={{ responseId: r.id }}>
                          <FileText className="size-3" /> Relatório
                        </Link>
                      </Button>
                      {/* Só onde o 360° existe de verdade. Antes o botão
                          aparecia em tudo e o servidor recusava depois do
                          clique — o mentor descobria o limite errando, uma vez
                          por avaliado. */}
                      {r.aceita_observador && (
                        <Button variant="ghost" size="sm" onClick={() => inviteObserver(r.id)}>
                          <UserPlus className="size-3" /> Convidar observador
                        </Button>
                      )}
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => copyLink(r.id)}>
                    <Copy className="size-3" /> Link
                  </Button>
                  <AcoesDoEnvio
                    nome={r.people?.full_name ?? "este avaliado"}
                    respondido={r.status === "submitted"}
                    cancelado={!!r.canceled_at}
                    onCancelar={(c) => cancelarResposta.mutate({ id: r.id, canceled: c })}
                    onExcluir={() => excluirResposta.mutate(r.id)}
                    ocupado={cancelarResposta.isPending || excluirResposta.isPending}
                  />
                </td>
              </tr>
            ))}
            {data.length === 0 && batteries.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                {isLoading ? "Carregando…" : "Nenhum envio ainda."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}