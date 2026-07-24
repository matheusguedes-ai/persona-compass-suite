import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ROLE_LABEL, type PersonRole } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Send, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPerson, deletePerson } from "@/lib/data.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pessoas/$id")({
  head: () => ({
    meta: [
      { title: "Perfil — Métrica Humana" },
      { name: "description", content: "Perfil do avaliado com testes enviados e histórico." },
    ],
  }),
  component: PersonProfile,
  errorComponent: ({ error }) => (
    <div className="grid place-items-center py-24 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="grid place-items-center py-24 text-sm text-muted-foreground">Pessoa não encontrada.</div>
  ),
});

function PersonProfile() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const getFn = useServerFn(getPerson);
  const delFn = useServerFn(deletePerson);
  const { data, isLoading, error } = useQuery({
    queryKey: ["person", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
      toast.success("Pessoa removida");
      nav({ to: "/pessoas" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (error || !data) return <div className="py-12 text-center text-sm text-destructive">{(error as Error)?.message ?? "Erro"}</div>;

  const { person, groups } = data;

  return (
    <div className="space-y-6">
      <Link to="/pessoas" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Voltar para pessoas
      </Link>

      <div className="flex items-start justify-between rounded-xl bg-card p-6 ring-1 ring-black/5">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-600 ring-1 ring-black/5">
            {person.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{person.full_name}</h1>
            <p className="text-sm text-muted-foreground">{person.email}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground ring-1 ring-black/5">
                {ROLE_LABEL[person.role as PersonRole]}
              </span>
              {person.phone && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground ring-1 ring-black/5">{person.phone}</span>}
              {person.profession && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground ring-1 ring-black/5">{person.profession}</span>}
              {person.role_at_company && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground ring-1 ring-black/5">{person.role_at_company}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Mail className="size-4" /> Enviar email</Button>
          <Button asChild size="sm"><Link to="/envios/novo"><Send className="size-4" /> Enviar teste</Link></Button>
          <Button variant="ghost" size="sm" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <InfoBox label="Telefone" value={person.phone} />
            <InfoBox label="Profissão" value={person.profession} />
            <InfoBox label="Cargo" value={person.role_at_company} />
            <InfoBox label="Cadastrada em" value={new Date(person.created_at).toLocaleDateString("pt-BR")} />
          </div>
          {person.notes && (
            <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Observações</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{person.notes}</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="grupos" className="mt-4">
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
            {groups.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Esta pessoa ainda não pertence a nenhum grupo.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {groups.map((g) => {
                  const info = g.groups as { id: string; name: string; type: string } | null;
                  if (!info) return null;
                  return (
                    <li key={info.id} className="flex items-center justify-between px-6 py-3">
                      <span className="text-sm font-medium">{info.name}</span>
                      <Link to="/grupos/$id" params={{ id: info.id }} className="text-xs text-accent hover:underline">Abrir</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}