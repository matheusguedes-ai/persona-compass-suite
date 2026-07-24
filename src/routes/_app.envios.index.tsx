import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SENDS, personById, instrumentById, type SendStatus } from "@/lib/mock-data";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function EnviosPage() {
  const [status, setStatus] = useState<"todos" | SendStatus>("todos");
  const list = SENDS.filter((s) => status === "todos" || s.status === status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Envios</h1>
          <p className="mt-1 text-sm text-muted-foreground">{SENDS.length} disparos registrados.</p>
        </div>
        <Button asChild><Link to="/envios/novo"><Plus className="size-4" /> Novo envio</Link></Button>
      </div>

      <div className="flex gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="concluido">Concluídos</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="expirado">Expirados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-muted/50">
            <tr>
              <th className="px-6 py-3 font-medium text-muted-foreground">Avaliado</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Instrumento</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Canal</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Enviado</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {list.map((s) => {
              const p = personById(s.personId);
              const i = instrumentById(s.instrumentId);
              return (
                <tr key={s.id} className="hover:bg-muted/40">
                  <td className="px-6 py-4 font-medium">{p?.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{i?.name}</td>
                  <td className="px-6 py-4"><StatusBadge status={s.status} /></td>
                  <td className="px-6 py-4 text-muted-foreground capitalize">{s.channel}</td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(s.sentAt).toLocaleDateString("pt-BR")}</td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://metricahumana.app/r/${s.id}`);
                        toast.success("Link copiado");
                      }}
                    >
                      <Copy className="size-3" /> Link
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}