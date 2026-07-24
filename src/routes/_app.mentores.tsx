import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMentors, createMentor, updateMentor, deleteMentor } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/mentores")({
  head: () => ({
    meta: [
      { title: "Mentores — Métrica Humana" },
      { name: "description", content: "Cadastre, edite e remova coaches e mentores da plataforma." },
      { property: "og:title", content: "Mentores — Métrica Humana" },
      { property: "og:description", content: "Gestão de coaches e mentores da plataforma." },
    ],
  }),
  component: MentoresPage,
});

type MentorRow = { id: string; name: string; email: string; specialty: string | null };

function MentoresPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<MentorRow | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const listFn = useServerFn(listMentors);
  const createFn = useServerFn(createMentor);
  const updateFn = useServerFn(updateMentor);
  const deleteFn = useServerFn(deleteMentor);

  const { data: mentors = [] } = useQuery({ queryKey: ["mentors"], queryFn: () => listFn() });
  const inv = () => qc.invalidateQueries({ queryKey: ["mentors"] });

  const create = useMutation({
    mutationFn: (v: { name: string; email: string; specialty: string | null }) => createFn({ data: v }),
    onSuccess: () => { inv(); toast.success("Mentor cadastrado"); setOpenNew(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; name: string; email: string; specialty: string | null }) => updateFn({ data: v }),
    onSuccess: () => { inv(); toast.success("Mentor atualizado"); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { inv(); toast.success("Mentor removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = mentors.filter((m) => {
    const t = q.toLowerCase();
    return m.name.toLowerCase().includes(t) || m.email.toLowerCase().includes(t) ||
      (m.specialty ?? "").toLowerCase().includes(t);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mentores</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mentors.length} coaches e mentores cadastrados.</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4" /> Adicionar mentor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo mentor</DialogTitle>
              <DialogDescription>Adicione um coach ou mentor à sua equipe.</DialogDescription>
            </DialogHeader>
            <MentorForm
              submitting={create.isPending}
              onSubmit={(v) => create.mutate(v)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 ring-1 ring-black/5">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, email ou especialidade"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-muted/50">
            <tr>
              <th className="px-6 py-3 font-medium text-muted-foreground">Mentor</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Email</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Especialidade</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {list.map((m) => (
              <tr key={m.id} className="hover:bg-muted/40">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 place-items-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600 ring-1 ring-black/5">
                      {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <span className="font-medium">{m.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{m.email}</td>
                <td className="px-6 py-4 text-muted-foreground">{m.specialty ?? "—"}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setEditing(m)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3" /> Editar
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline">
                          <Trash2 className="size-3" /> Remover
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover mentor</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover <strong>{m.name}</strong>? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(m.id)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-muted-foreground">Nenhum mentor encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar mentor</DialogTitle>
          </DialogHeader>
          {editing && (
            <MentorForm
              initial={editing}
              submitting={update.isPending}
              onSubmit={(v) => update.mutate({ id: editing.id, ...v })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MentorForm({
  initial, submitting, onSubmit,
}: {
  initial?: { name: string; email: string; specialty: string | null };
  submitting: boolean;
  onSubmit: (v: { name: string; email: string; specialty: string | null }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [specialty, setSpecialty] = useState(initial?.specialty ?? "");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) return;
        onSubmit({ name: name.trim(), email: email.trim(), specialty: specialty.trim() || null });
      }}
    >
      <div className="space-y-2"><Label>Nome</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" /></div>
      <div className="space-y-2"><Label>Email</Label><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mentor@empresa.com" /></div>
      <div className="space-y-2"><Label>Especialidade</Label><Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex.: Coaching Executivo" /></div>
      <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Salvar"}</Button></DialogFooter>
    </form>
  );
}