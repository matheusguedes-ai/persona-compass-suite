import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listResponses, createObserverInvite } from "@/lib/tests.functions";
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
  created_at: string;
  observers_invited?: number;
  observers_answered?: number;
  people: { id: string; full_name: string; email: string } | null;
  test_versions: { id: string; title: string; instrument_id: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  submitted: "Concluído",
  expired: "Expirado",
};

function EnviosPage() {
  const listFn = useServerFn(listResponses);
  const inviteFn = useServerFn(createObserverInvite);
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["responses"],
    queryFn: () => listFn({ data: {} }) as Promise<ResponseRow[]>,
  });

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/responder/${id}`);
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
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o convite");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Envios</h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.length} disparos registrados.</p>
        </div>
        <Button asChild><Link to="/envios/novo"><Plus className="size-4" /> Novo envio</Link></Button>
      </div>

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
            {data.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-6 py-4 font-medium">{r.people?.full_name ?? "—"}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.test_versions?.title ?? "—"}</td>
                <td className="px-6 py-4 text-muted-foreground">{STATUS_LABEL[r.status] ?? r.status}</td>
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
                      <Button variant="ghost" size="sm" onClick={() => inviteObserver(r.id)}>
                        <UserPlus className="size-3" /> Convidar observador
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => copyLink(r.id)}>
                    <Copy className="size-3" /> Link
                  </Button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
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