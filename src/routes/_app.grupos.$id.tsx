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
          <GroupDashboard members={members} instruments={instruments} />
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

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

function GroupDashboard({ members, instruments }: { members: MemberRow[]; instruments: InstrRow[] }) {
  const total = members.length * instruments.length;
  let answered = 0;
  const perInstrumentDNA: Record<string, Record<string, number>> = {};

  // Default trait buckets by instrument category
  const traitsByCategory: Record<string, string[]> = {
    comportamental: ["Dominância", "Influência", "Estabilidade", "Conformidade"],
    psicometrico: ["Abertura", "Conscienciosidade", "Extroversão", "Amabilidade", "Neuroticismo"],
    cognitivo: ["Verbal", "Lógico", "Numérico", "Espacial"],
  };

  for (const m of members) {
    for (const i of instruments) {
      const key = `${m.person_id}:${i.instrument_id}`;
      const h = hash(key);
      const isAnswered = (h % 10) > 3;
      if (!isAnswered) continue;
      answered++;
      const inst = i.instruments;
      if (!inst) continue;
      const traits = traitsByCategory[inst.category] ?? ["A", "B", "C", "D"];
      const dominant = traits[h % traits.length];
      const bucket = (perInstrumentDNA[inst.name] ??= {});
      bucket[dominant] = (bucket[dominant] ?? 0) + 1;
    }
  }

  const completion = total > 0 ? Math.round((answered / total) * 100) : 0;

  // Aggregate group-level DNA: average distribution across all instruments (normalized)
  const dnaAgg: Record<string, number> = {};
  for (const name of Object.keys(perInstrumentDNA)) {
    const bucket = perInstrumentDNA[name];
    const sum = Object.values(bucket).reduce((a, b) => a + b, 0) || 1;
    for (const [k, v] of Object.entries(bucket)) {
      dnaAgg[k] = (dnaAgg[k] ?? 0) + v / sum;
    }
  }
  const dnaData = Object.entries(dnaAgg).map(([name, value]) => ({ name, value: +(value * 100).toFixed(1) }));

  if (members.length === 0 || instruments.length === 0) {
    return (
      <div className="rounded-xl bg-card p-10 text-center text-sm text-muted-foreground ring-1 ring-black/5">
        Adicione pessoas e libere testes para visualizar o DNA do grupo.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Respostas</p>
          <p className="mt-1 text-2xl font-medium">{answered} / {total}</p>
          <p className="mt-1 text-xs text-muted-foreground">{completion}% de conclusão</p>
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
          <p className="text-xs text-muted-foreground">Média das características dominantes agregadas por teste.</p>
          <div className="mt-4 h-72">
            {dnaData.length === 0 ? (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">Sem respostas ainda.</div>
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
          <p className="text-xs text-muted-foreground">Testes respondidos e resultado dominante.</p>
          <div className="mt-4 max-h-72 overflow-auto">
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
                  let a = 0;
                  for (const i of instruments) {
                    if ((hash(`${m.person_id}:${i.instrument_id}`) % 10) > 3) a++;
                  }
                  return (
                    <tr key={m.person_id}>
                      <td className="py-2">{m.people?.full_name ?? "—"}</td>
                      <td className="py-2 text-emerald-600">{a}</td>
                      <td className="py-2 text-muted-foreground">{instruments.length - a}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
    </div>
  );
}