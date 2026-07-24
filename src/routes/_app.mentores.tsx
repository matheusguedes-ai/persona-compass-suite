import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MENTORS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
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

function MentoresPage() {
  const [q, setQ] = useState("");
  const list = MENTORS.filter((m) =>
    m.name.toLowerCase().includes(q.toLowerCase()) ||
    m.email.toLowerCase().includes(q.toLowerCase()) ||
    m.specialty.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mentores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {MENTORS.length} coaches e mentores cadastrados.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus className="size-4" /> Adicionar mentor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo mentor</DialogTitle>
              <DialogDescription>Adicione um coach ou mentor à sua equipe.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("Mentor cadastrado (demo)");
                (e.currentTarget as HTMLFormElement).reset();
              }}
            >
              <div className="space-y-2"><Label>Nome</Label><Input required placeholder="Nome completo" /></div>
              <div className="space-y-2"><Label>Email</Label><Input required type="email" placeholder="mentor@empresa.com" /></div>
              <div className="space-y-2"><Label>Especialidade</Label><Input placeholder="Ex.: Coaching Executivo" /></div>
              <DialogFooter><Button type="submit">Cadastrar</Button></DialogFooter>
            </form>
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
              <th className="px-6 py-3 font-medium text-muted-foreground">Sessões ativas</th>
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
                <td className="px-6 py-4 text-muted-foreground">{m.specialty}</td>
                <td className="px-6 py-4 text-muted-foreground">{m.activeSessions}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => toast.info("Editar mentor (demo)")}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3" /> Editar
                    </button>
                    <button
                      onClick={() => toast.error("Remoção (demo)")}
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
                    >
                      <Trash2 className="size-3" /> Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">Nenhum mentor encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}