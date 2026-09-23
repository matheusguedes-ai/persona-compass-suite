import { mensagemDeErro } from "@/lib/erro-legivel";
import { AbasDeTestes } from "@/components/abas-testes";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCampanhas, listResponses, listAssessments, createObserverInvite,
  setResponseCanceled, setAssessmentCanceled, deleteResponse, deleteAssessment,
} from "@/lib/tests.functions";
import { AcoesDoEnvio } from "@/components/acoes-do-envio";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, FileText, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/envios/")({
  head: () => ({
    meta: [
      { title: "Campanhas — Métrica Humana" },
      { name: "description", content: "Testes enviados, organizados por campanha." },
      { property: "og:title", content: "Campanhas — Métrica Humana" },
      { property: "og:description", content: "Testes enviados, organizados por campanha." },
    ],
  }),
  component: EnviosPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  submitted: "Concluído",
  expired: "Expirado",
};

function EnviosPage() {
  const listCampanhasFn = useServerFn(listCampanhas);
  const { data: campanhas = [], isLoading: carregandoCampanhas } = useQuery({
    queryKey: ["campanhas"],
    queryFn: () => listCampanhasFn(),
  });

  // #301 item 6 — campanhas antigas que a migração achou ainda ATIVAS
  // (aceitando resposta nova), pra o dono arrumar a casa de forma clara em
  // vez de descobrir remexendo. Sinal simples: ativa e criada há mais de 30
  // dias — uma campanha corrente não costuma ficar tanto tempo sem alguém
  // olhar pra ela de novo.
  const precisamDeAtencao = useMemo(() => {
    const trintaDiasAtras = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return campanhas.filter((c) => c.is_active && new Date(c.created_at).getTime() < trintaDiasAtras);
  }, [campanhas]);

  const listFn = useServerFn(listResponses);
  const listAssessmentsFn = useServerFn(listAssessments);
  const inviteFn = useServerFn(createObserverInvite);
  const { data: todasRespostas = [], isLoading, refetch } = useQuery({
    queryKey: ["responses"],
    queryFn: () => listFn({ data: {} }),
  });
  const { data: todasBaterias = [] } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => listAssessmentsFn({ data: {} }),
  });
  // #301 item 7 — o envio avulso (sem campanha) só existe hoje por ser de
  // ANTES desta demanda: a tela não oferece mais criar um sem campanha. Fica
  // aqui, à parte, para não sumir com o que já existia.
  const data = useMemo(() => todasRespostas.filter((r) => !r.invite_link_id), [todasRespostas]);
  const batteries = useMemo(() => todasBaterias.filter((b) => !b.invite_link_id), [todasBaterias]);

  const qc = useQueryClient();
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {campanhas.length === 1 ? "1 campanha" : `${campanhas.length} campanhas`} — é por aqui que você encontra as respostas.
          </p>
        </div>
        <AbasDeTestes />
        <Button asChild><Link to="/envios/novo" search={{ personId: undefined, groupId: undefined }}><Plus className="size-4" /> Nova campanha</Link></Button>
      </div>

      {precisamDeAtencao.length > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="font-medium">
              {precisamDeAtencao.length === 1 ? "1 campanha antiga ainda ativa" : `${precisamDeAtencao.length} campanhas antigas ainda ativas`}
            </p>
            <p className="text-sm text-muted-foreground">
              Sem nenhuma resposta nova há mais de 30 dias, mas continuam aceitando gente. Vale encerrar as que não usa mais.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {precisamDeAtencao.map((c) => (
                <Link
                  key={c.id} to="/envios/$campanhaId" params={{ campanhaId: c.id }}
                  className="rounded-full bg-card px-3 py-1 text-xs font-medium ring-1 ring-black/10 hover:bg-muted"
                >
                  {c.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
        {carregandoCampanhas ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : campanhas.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma campanha ainda.{" "}
            <Link to="/envios/novo" search={{ personId: undefined, groupId: undefined }} className="font-medium text-accent hover:underline">
              Crie a primeira
            </Link>.
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {campanhas.map((c) => {
              const naoComecou = !!c.starts_at && new Date(c.starts_at).getTime() > Date.now();
              const expirada = !!c.expires_at && new Date(c.expires_at).getTime() < Date.now();
              const status = !c.is_active ? "Encerrada" : expirada ? "Expirada" : naoComecou ? "Agendada" : "Ativa";
              return (
                <li key={c.id}>
                  <Link to="/envios/$campanhaId" params={{ campanhaId: c.id }} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{c.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-black/5 ${
                          status === "Ativa" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" :
                          status === "Agendada" ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" :
                          "bg-muted text-muted-foreground"
                        }`}>{status}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {c.testes.join(", ") || "—"}
                        {c.groups?.name && ` · Grupo: ${c.groups.name}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.starts_at && `De ${new Date(c.starts_at).toLocaleDateString("pt-BR")} `}
                        {c.expires_at && `até ${new Date(c.expires_at).toLocaleDateString("pt-BR")}`}
                        {!c.starts_at && !c.expires_at && "Sem prazo"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-center text-sm">
                      <div><div className="font-semibold">{c.total}</div><div className="text-[11px] text-muted-foreground">total</div></div>
                      <div><div className="font-semibold text-emerald-600 dark:text-emerald-400">{c.respondidos}</div><div className="text-[11px] text-muted-foreground">respondido</div></div>
                      <div><div className="font-semibold text-amber-600 dark:text-amber-400">{c.pendentes}</div><div className="text-[11px] text-muted-foreground">pendente</div></div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(data.length > 0 || batteries.length > 0) && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Envios sem campanha</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">De antes desta tela existir — continuam aqui, geríveis como sempre.</p>
          <div className="mt-3 overflow-x-auto rounded-xl bg-card ring-1 ring-black/5">
            <table className="w-full min-w-[860px] text-left text-sm">
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
                      {(r.observers_invited ?? 0) === 0 ? "—" : `${r.observers_answered ?? 0} de ${r.observers_invited} respondido(s)`}
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
                {data.length === 0 && batteries.length === 0 && isLoading && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">Carregando…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
