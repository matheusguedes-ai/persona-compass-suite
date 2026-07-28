import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GROUP_TYPE_LABEL, type GroupType } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RankingDoGrupo } from "@/components/ranking-do-grupo";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Send, Trash2 } from "lucide-react";
import { ImportarPlanilha } from "@/components/importar-planilha";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getGroup, getGroupDna, deleteGroup, addGroupMembers, removeGroupMember,
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={del.isPending}>
              <Trash2 className="size-4" /> Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir grupo</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o grupo <strong>{group.name}</strong>? Os membros e testes liberados serão desvinculados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate()}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Tabs defaultValue="pessoas">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pessoas">Pessoas ({members.length})</TabsTrigger>
          <TabsTrigger value="testes">Testes liberados ({instruments.length})</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <GroupDashboard groupId={id} members={members} instruments={instruments} />
        </TabsContent>

        <TabsContent value="pessoas" className="mt-4 space-y-3">
          <div className="flex flex-wrap justify-end gap-2">
            <ImportarPlanilha groupId={id} />
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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost"><Trash2 className="size-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover do grupo</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remover <strong>{p.full_name}</strong> deste grupo? A pessoa permanecerá cadastrada.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeMember.mutate(m.person_id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="testes" className="mt-4">
          {/* Marcar aqui não enviava nada — a lista só ganha sentido virando um
              disparo para o grupo inteiro de uma vez. */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-4 ring-1 ring-black/5">
            <div>
              <p className="text-sm font-medium">Enviar para todo o grupo</p>
              <p className="text-xs text-muted-foreground">
                {members.length === 0
                  ? "Adicione pessoas ao grupo para poder enviar."
                  : instruments.length === 0
                    ? "Marque abaixo pelo menos um teste para liberar."
                    : `${instruments.length} teste(s) para ${members.length} pessoa(s), num disparo só.`}
              </p>
            </div>
            <Button asChild disabled={members.length === 0 || instruments.length === 0}>
              <Link to="/envios/novo" search={{ personId: undefined, groupId: id }}>
                <Send className="size-4" /> Enviar para o grupo
              </Link>
            </Button>
          </div>

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
        <TabsContent value="ranking" className="mt-4">
          <RankingDoGrupo groupId={id} />
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

      <GroupDna groupId={groupId} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

    </div>
  );
}
/**
 * DNA do grupo: média de cada dimensão, separada por instrumento.
 * Cada teste tem sua própria escala e dimensões, então NÃO se mistura tudo
 * num gráfico só — isso produziria um número sem significado.
 */
function GroupDna({ groupId }: { groupId: string }) {
  const dnaFn = useServerFn(getGroupDna);
  const { data, isLoading } = useQuery({
    queryKey: ["group-dna", groupId],
    queryFn: () => dnaFn({ data: { group_id: groupId } }),
  });

  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-black/5">
        Calculando o DNA do grupo…
      </div>
    );
  }
  const instruments = data?.instruments ?? [];
  if (instruments.length === 0) {
    return (
      <div className="rounded-xl bg-card p-8 text-center ring-1 ring-black/5">
        <p className="text-sm font-medium">DNA do grupo</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Aparece aqui quando alguém do grupo concluir um teste.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">DNA do grupo</h3>
        <p className="text-xs text-muted-foreground">
          Média de cada dimensão entre quem já concluiu. Cada inventário tem escala própria, então aparece separado.
        </p>
      </div>

      {instruments.map((inst) => (
        <div key={inst.instrument_id} className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-medium">{inst.name}</h4>
            <span className="text-xs text-muted-foreground">
              {inst.sample} {inst.sample === 1 ? "pessoa" : "pessoas"}
            </span>
          </div>

          {inst.sample < 3 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              Amostra pequena: com {inst.sample === 1 ? "uma pessoa" : `${inst.sample} pessoas`} a média ainda descreve
              indivíduos, não o grupo. Leia com cautela.
            </p>
          )}

          <div className="mt-4 space-y-3">
            {inst.dimensions.map((d) => (
              <div key={d.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">
                    {d.label} <span className="text-xs text-muted-foreground">({d.key})</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    média {Math.round(d.average)}
                    {d.count > 1 && ` · varia de ${Math.round(d.min)} a ${Math.round(d.max)}`}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, d.average))}%`, background: d.color ?? "var(--muted-foreground)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
