import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GROUP_TYPE_LABEL, type GroupType } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Users2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGroups, createGroup, listPeople, listInstruments } from "@/lib/data.functions";

export const Route = createFileRoute("/_app/grupos/")({
  head: () => ({
    meta: [
      { title: "Grupos — Métrica Humana" },
      { name: "description", content: "Crie campanhas segmentadas por turma, empresa ou setor e dispare testes em lote." },
      { property: "og:title", content: "Grupos — Métrica Humana" },
      { property: "og:description", content: "Campanhas segmentadas para envio de testes em lote." },
    ],
  }),
  component: GruposPage,
});

function GruposPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | GroupType>("todos");
  const listFn = useServerFn(listGroups);
  const { data: groups = [], isLoading } = useQuery({ queryKey: ["groups"], queryFn: () => listFn() });
  const list = groups.filter((g) => {
    const okQ = g.name.toLowerCase().includes(q.toLowerCase());
    const okT = filter === "todos" || g.type === filter;
    return okQ && okT;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Grupos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Segmente pessoas em turmas, empresas ou setores para campanhas de envio em lote.
          </p>
        </div>
        <NewGroupDialog />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md bg-muted px-3 py-1.5 ring-1 ring-black/5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar grupo"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="turma">Turmas</SelectItem>
            <SelectItem value="empresa">Empresas</SelectItem>
            <SelectItem value="setor">Setores</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-muted/50">
            <tr>
              <th className="px-6 py-3 font-medium text-muted-foreground">Grupo</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Tipo</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Pessoas</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Testes</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {list.map((g) => (
              <tr key={g.id} className="hover:bg-muted/40">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground ring-1 ring-black/5">
                      <Users2 className="size-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{g.name}</span>
                      {g.description && <span className="text-xs text-muted-foreground">{g.description}</span>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-black/5">
                    {GROUP_TYPE_LABEL[g.type as GroupType]}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{g.people_count}</td>
                <td className="px-6 py-4 text-muted-foreground">{g.instruments_count}</td>
                <td className="px-6 py-4 text-right">
                  <Link to="/grupos/$id" params={{ id: g.id }} className="text-xs font-medium text-accent hover:underline">
                    Abrir grupo
                  </Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                {isLoading ? "Carregando…" : "Nenhum grupo encontrado."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewGroupDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<GroupType>("turma");
  const [description, setDescription] = useState("");
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [instrumentIds, setInstrumentIds] = useState<string[]>([]);
  const [personQuery, setPersonQuery] = useState("");

  const qc = useQueryClient();
  const peopleFn = useServerFn(listPeople);
  const instrFn = useServerFn(listInstruments);
  const createFn = useServerFn(createGroup);
  const { data: people = [] } = useQuery({ queryKey: ["people"], queryFn: () => peopleFn(), enabled: open });
  const { data: instruments = [] } = useQuery({ queryKey: ["instruments"], queryFn: () => instrFn(), enabled: open });

  const filteredPeople = useMemo(
    () => people.filter((p) => (p.full_name + p.email).toLowerCase().includes(personQuery.toLowerCase())),
    [people, personQuery],
  );

  const create = useMutation({
    mutationFn: (data: { name: string; type: GroupType; description: string | null; person_ids: string[]; instrument_ids: string[] }) =>
      createFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Grupo criado");
      reset();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao criar grupo."),
  });

  function reset() {
    setOpen(false); setStep(1); setName(""); setType("turma"); setDescription("");
    setPersonIds([]); setInstrumentIds([]); setPersonQuery("");
  }

  function toggle(id: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : reset())}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Novo grupo</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo grupo — passo {step} de 3</DialogTitle>
          <DialogDescription>
            {step === 1 && "Defina o escopo do grupo."}
            {step === 2 && "Adicione as pessoas que farão parte deste grupo."}
            {step === 3 && "Escolha quais testes ficarão disponíveis para este grupo."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome do grupo</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Turma Liderança 2026.1" /></div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as GroupType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="turma">Turma</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                  <SelectItem value="setor">Setor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contexto ou objetivo da campanha" /></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Input placeholder="Buscar pessoa" value={personQuery} onChange={(e) => setPersonQuery(e.target.value)} />
            <div className="max-h-80 overflow-auto rounded-md border border-black/5">
              {filteredPeople.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma pessoa cadastrada ainda.</p>}
              {filteredPeople.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b border-black/5 px-4 py-2 last:border-b-0 hover:bg-muted/40">
                  <Checkbox checked={personIds.includes(p.id)} onCheckedChange={() => toggle(p.id, personIds, setPersonIds)} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{p.full_name}</span>
                    <span className="text-xs text-muted-foreground">{p.email}</span>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{personIds.length} selecionada(s)</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {instruments.map((i) => (
                <label key={i.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-black/5 p-3 hover:bg-muted/40">
                  <Checkbox checked={instrumentIds.includes(i.id)} onCheckedChange={() => toggle(i.id, instrumentIds, setInstrumentIds)} />
                  <div>
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.duration_min} min · {i.category}</p>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{instrumentIds.length} teste(s) liberado(s)</p>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => (step > 1 ? setStep(step - 1) : reset())}>
            {step > 1 ? "Voltar" : "Cancelar"}
          </Button>
          {step < 3 ? (
            <Button type="button" disabled={step === 1 && !name.trim()} onClick={() => setStep(step + 1)}>Próximo</Button>
          ) : (
            <Button
              type="button"
              disabled={create.isPending || !name.trim()}
              onClick={() =>
                create.mutate({
                  name: name.trim(),
                  type,
                  description: description.trim() || null,
                  person_ids: personIds,
                  instrument_ids: instrumentIds,
                })
              }
            >
              {create.isPending ? "Criando…" : "Criar grupo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}