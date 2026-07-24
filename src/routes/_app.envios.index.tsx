import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listResponses } from "@/lib/tests.functions";
import { Button } from "@/components/ui/button";
import { Copy, Plus } from "lucide-react";
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
  const { data = [], isLoading } = useQuery({
    queryKey: ["responses"],
    queryFn: () => listFn({ data: {} }) as Promise<ResponseRow[]>,
  });

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/responder/${id}`);
    toast.success("Link copiado");
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
                <td className="px-6 py-4 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => copyLink(r.id)}>
                    <Copy className="size-3" /> Link
                  </Button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                {isLoading ? "Carregando…" : "Nenhum envio ainda."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}