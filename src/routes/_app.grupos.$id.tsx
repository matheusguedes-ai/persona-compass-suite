import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GROUP_TYPE_LABEL, type GroupType } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getGroup, deleteGroup, addGroupMembers, removeGroupMember,
  setGroupInstruments, listPeople, listInstruments,
} from "@/lib/data.functions";
import { listResponses } from "@/lib/tests.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/grupos/$id")({
  head: () => ({
    meta: [
      { title: "Grupo — Métrica Humana" },
      { name: "description", content: "Gerencie pessoas e testes liberados deste grupo." },
    ],
  }),
  component: GroupDetail,
  errorComponent: ({ error }) => (
    <div className="grid place-items-center py-24 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="grid place-items-center py-24 text-sm text-muted-foreground">Grupo não encontrado.</div>
  ),
});

function GroupDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();

  const getFn = useServerFn(getGroup);
  const delFn = useServerFn(deleteGroup);
  const removeFn = useServerFn(removeGroupMember);
  const setInstrFn = useServerFn(setGroupInstruments);
  const instrListFn = useServerFn(listInstruments);

  const { data, isLoading, error } = useQuery({
    queryKey: ["group", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const { data: allInstruments = [] } = useQuery({
    queryKey: ["instruments"],
    queryFn: () => instrListFn(),
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Grupo excluído");
      nav({ to: "/grupos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: (person_id: string) => removeFn({ data: { group_id: id, person_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const setInstr = useMutation({
    mutationFn: (instrument_ids: string[]) => setInstrFn({ data: { group_id: id, instrument_ids } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", id] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Testes liberados atualizados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (error || !data) return <div className="py-12 text-center text-sm text-destructive">{(error as Error)?.message ?? "Erro"}</div>;

  const { group, members, instruments } = data;
  const currentInstrIds = instruments.map((i) => i.instrument_id);

  return (
    <div className="space-y-6">
      <Link to="/grupos" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Voltar para grupos
      </Link>

      <div className="flex items-start justify-between rounded-xl bg-card p-6 ring-1 ring-black/5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{group.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground ring-1 ring-black/5">
              {GROUP_TYPE_LABEL[group.type as GroupType]}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground ring-1 ring-black/5">{members.length} pessoa(s)</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground ring-1 ring-black/5">{instruments.length} teste(s) liberado(s)</span>
          </div>
          {group.description && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{group.description}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => del.mutate()} disabled={del.isPending}>
          <Trash2 className="size-4" /> Excluir
        </Button>
      </div>

      <Tabs defaultValue="pessoas">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pessoas">Pessoas ({members.length})</TabsTrigger>
          <TabsTrigger value="testes">Testes liberados ({instruments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <GroupDashboard groupId={id} members={members} instruments={instruments} />
        </TabsContent>

        <TabsContent value="pessoas" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <AddPeopleDialog groupId={id} excludeIds={members.map((m) => m.person_id)} />
          </div>
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
            {members.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma pessoa neste grupo. Adicione a primeira.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {members.map((m) => {
                  const p = m.people as { id: string; full_name: string; email: string } | null;
                  if (!p) return null;
                  return (
                    <li key={m.person_id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link to="/pessoas/$id" params={{ id: p.id }} className="text-xs text-accent hover:underline">Perfil</Link>
                        <Button size="sm" variant="ghost" onClick={() => removeMember.mutate(m.person_id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="testes" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Marque os testes que este grupo pode receber. Você pode alterar a qualquer momento.
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {allInstruments.map((i) => {
              const checked = currentInstrIds.includes(i.id);
              return (
                <label key={i.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-black/5 bg-card p-3 hover:bg-muted/40">
                  <Checkbox
                    checked={checked}
                    disabled={setInstr.isPending}
                    onCheckedChange={() => {
                      const next = checked ? currentInstrIds.filter((x) => x !== i.id) : [...currentInstrIds, i.id];
                      setInstr.mutate(next);
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.duration_min} min · {i.category}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddPeopleDialog({ groupId, excludeIds }: { groupId: string; excludeIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const qc = useQueryClient();
  const peopleFn = useServerFn(listPeople);
  const addFn = useServerFn(addGroupMembers);
  const { data: people = [] } = useQuery({ queryKey: ["people"], queryFn: () => peopleFn(), enabled: open });

  const available = useMemo(
    () => people.filter((p) => !excludeIds.includes(p.id) && (p.full_name + p.email).toLowerCase().includes(q.toLowerCase())),
    [people, excludeIds, q],
  );

  const add = useMutation({
    mutationFn: () => addFn({ data: { group_id: groupId, person_ids: selected } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Pessoas adicionadas");
      setSelected([]); setQ(""); setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" /> Adicionar pessoas</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar pessoas ao grupo</DialogTitle>
        </DialogHeader>
        <Input placeholder="Buscar pessoa" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-72 overflow-auto rounded-md border border-black/5">
          {available.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma pessoa disponível.</p>}
          {available.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b border-black/5 px-4 py-2 last:border-b-0 hover:bg-muted/40">
              <Checkbox
                checked={selected.includes(p.id)}
                onCheckedChange={() => setSelected(selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id])}
              />
              <div>
                <p className="text-sm font-medium">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button disabled={selected.length === 0 || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? "Adicionando…" : `Adicionar ${selected.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MemberRow = { person_id: string; people: { id: string; full_name: string; email: string; role: string } | null };
type InstrRow = { instrument_id: string; instruments: { id: string; name: string; short_name: string | null; category: string; duration_min: number } | null };

const DNA_COLORS = ["#0891b2", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#22c55e", "#3b82f6", "#ec4899"];

type ResponseRow = {
  id: string;
  person_id: string;
  status: string;
  submitted_at: string | null;
  dominant_dimension_id: string | null;
  computed_scores: Record<string, number> | null;
  test_versions: { id: string; title: string; instrument_id: string } | null;
};

function GroupDashboard({ groupId, members, instruments }: { groupId: string; members: MemberRow[]; instruments: InstrRow[] }) {
  const listRespFn = useServerFn(listResponses);
  const personIds = useMemo(() => members.map((m) => m.person_id), [members]);
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["group-responses", groupId, personIds.join(",")],
    queryFn: () => listRespFn({ data: { person_ids: personIds } }),
    enabled: personIds.length > 0,
  });

  if (members.length === 0 || instruments.length === 0) {
    return (
      <div className="rounded-xl bg-card p-10 text-center text-sm text-muted-foreground ring-1 ring-black/5">
        Adicione pessoas e libere testes para visualizar o DNA do grupo.
      </div>
    );
  }
  if (isLoading) {
    return <div className="rounded-xl bg-card p-10 text-center text-sm text-muted-foreground ring-1 ring-black/5">Carregando respostas…</div>;
  }

  const rs = responses as ResponseRow[];
  const allowedInstrumentIds = new Set(instruments.map((i) => i.instrument_id));
  const scoped = rs.filter((r) => r.test_versions && allowedInstrumentIds.has(r.test_versions.instrument_id));
  const submitted = scoped.filter((r) => r.status === "submitted");
  const total = scoped.length;
  const answered = submitted.length;
  const completion = total > 0 ? Math.round((answered / total) * 100) : 0;

  const dnaCounts: Record<string, number> = {};
  for (const r of submitted) {
    if (!r.dominant_dimension_id) continue;
    dnaCounts[r.dominant_dimension_id] = (dnaCounts[r.dominant_dimension_id] ?? 0) + 1;
  }
  const dnaSum = Object.values(dnaCounts).reduce((a, b) => a + b, 0) || 1;
  const dnaData = Object.entries(dnaCounts).map(([id, count]) => ({
    name: id.slice(0, 6),
    value: +((count / dnaSum) * 100).toFixed(1),
  }));

  const perInstrumentDNA: Record<string, Record<string, number>> = {};
  for (const r of submitted) {
    const inst = instruments.find((i) => i.instrument_id === r.test_versions?.instrument_id)?.instruments;
    if (!inst || !r.dominant_dimension_id) continue;
    const bucket = (perInstrumentDNA[inst.name] ??= {});
    const key = r.dominant_dimension_id.slice(0, 6);
    bucket[key] = (bucket[key] ?? 0) + 1;
  }

  const perPerson = new Map<string, { answered: number; total: number }>();
  for (const m of members) perPerson.set(m.person_id, { answered: 0, total: 0 });
  for (const r of scoped) {
    const p = perPerson.get(r.person_id);
    if (!p) continue;
    p.total += 1;
    if (r.status === "submitted") p.answered += 1;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Respostas</p>
          <p className="mt-1 text-2xl font-medium">{answered} / {total}</p>
          <p className="mt-1 text-xs text-muted-foreground">{total > 0 ? `${completion}% de conclusão` : "Nenhum envio ainda"}</p>
        </div>
        <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pessoas</p>
          <p className="mt-1 text-2xl font-medium">{members.length}</p>
        </div>
        <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Testes liberados</p>
          <p className="mt-1 text-2xl font-medium">{instruments.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <h3 className="text-sm font-medium">DNA do grupo</h3>
          <p className="text-xs text-muted-foreground">Distribuição das dimensões dominantes das respostas concluídas.</p>
          <div className="mt-4 h-72">
            {dnaData.length === 0 ? (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">Nenhuma resposta ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dnaData} dataKey="value" nameKey="name" outerRadius={100} label={(e) => `${e.name} ${e.value}%`}>
                    {dnaData.map((_, idx) => (
                      <Cell key={idx} fill={DNA_COLORS[idx % DNA_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <h3 className="text-sm font-medium">Status por pessoa</h3>
          <p className="text-xs text-muted-foreground">Testes enviados vs. respondidos por pessoa.</p>
          <div className="mt-4 max-h-72 overflow-auto">
            {total === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Nenhum envio criado para este grupo ainda.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2">Pessoa</th>
                    <th className="py-2">Respondidos</th>
                    <th className="py-2">Pendentes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {members.map((m) => {
                    const stat = perPerson.get(m.person_id) ?? { answered: 0, total: 0 };
                    return (
                      <tr key={m.person_id}>
                        <td className="py-2">{m.people?.full_name ?? "—"}</td>
                        <td className="py-2 text-emerald-600">{stat.answered}</td>
                        <td className="py-2 text-muted-foreground">{Math.max(0, stat.total - stat.answered)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {Object.keys(perInstrumentDNA).length > 0 && (
        <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <h3 className="text-sm font-medium">Distribuição por teste</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(perInstrumentDNA).map(([name, bucket]) => {
            const sum = Object.values(bucket).reduce((a, b) => a + b, 0) || 1;
            const data = Object.entries(bucket).map(([k, v]) => ({ name: k, value: +((v / sum) * 100).toFixed(1) }));
            return (
              <div key={name} className="rounded-lg border border-black/5 p-3">
                <p className="text-xs font-medium">{name}</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data} dataKey="value" nameKey="name" outerRadius={55}>
                        {data.map((_, idx) => (
                          <Cell key={idx} fill={DNA_COLORS[idx % DNA_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  {data.map((d, idx) => (
                    <span key={d.name} className="inline-flex items-center gap-1">
                      <span className="inline-block size-2 rounded-sm" style={{ background: DNA_COLORS[idx % DNA_COLORS.length] }} />
                      {d.name} {d.value}%
                    </span>
                  ))}
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}
    </div>
  );
}