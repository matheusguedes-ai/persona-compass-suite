import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { personById, SENDS, instrumentById, ROLE_LABEL } from "@/lib/mock-data";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Send } from "lucide-react";

export const Route = createFileRoute("/_app/pessoas/$id")({
  loader: ({ params }) => {
    const person = personById(params.id);
    if (!person) throw notFound();
    return { person };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.person.name} — Métrica Humana` : "Perfil — Métrica Humana" },
      { name: "description", content: "Perfil do avaliado com testes enviados e histórico." },
    ],
  }),
  component: PersonProfile,
  notFoundComponent: () => (
    <div className="grid place-items-center py-24 text-sm text-muted-foreground">Pessoa não encontrada.</div>
  ),
});

function PersonProfile() {
  const { person } = Route.useLoaderData();
  const sends = SENDS.filter((s) => s.personId === person.id);

  return (
    <div className="space-y-6">
      <Link to="/pessoas" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Voltar para pessoas
      </Link>

      <div className="flex items-start justify-between rounded-xl bg-card p-6 ring-1 ring-black/5">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-600 ring-1 ring-black/5">
            {person.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{person.name}</h1>
            <p className="text-sm text-muted-foreground">{person.email}</p>
            <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-black/5">
              {ROLE_LABEL[person.role]}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Mail className="size-4" /> Enviar email</Button>
          <Button asChild size="sm"><Link to="/envios/novo"><Send className="size-4" /> Enviar teste</Link></Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="testes">Testes recebidos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Testes recebidos</p>
              <p className="mt-1 text-2xl font-medium">{sends.length}</p>
            </div>
            <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Concluídos</p>
              <p className="mt-1 text-2xl font-medium">{sends.filter((s) => s.status === "concluido").length}</p>
            </div>
            <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Pendentes</p>
              <p className="mt-1 text-2xl font-medium">{sends.filter((s) => s.status !== "concluido").length}</p>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-black/10 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Os relatórios detalhados aparecerão aqui quando os testes forem construídos.
          </div>
        </TabsContent>
        <TabsContent value="testes" className="mt-4">
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/5 bg-muted/50">
                <tr>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Instrumento</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {sends.map((s) => (
                  <tr key={s.id}>
                    <td className="px-6 py-4">{instrumentById(s.instrumentId)?.name}</td>
                    <td className="px-6 py-4"><StatusBadge status={s.status} /></td>
                    <td className="px-6 py-4 text-muted-foreground">{new Date(s.sentAt).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {sends.length === 0 && (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-sm text-muted-foreground">Nenhum teste enviado ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <div className="rounded-xl border border-dashed border-black/10 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Histórico de interações em breve.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}