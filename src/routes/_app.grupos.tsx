import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GROUPS, GROUP_TYPE_LABEL, type GroupType } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Send, Users2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/grupos")({
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
  const list = GROUPS.filter((g) => {
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
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus className="size-4" /> Novo grupo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo grupo</DialogTitle>
              <DialogDescription>Defina o escopo do grupo para depois adicionar pessoas e enviar testes.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("Grupo criado (demo)");
                (e.currentTarget as HTMLFormElement).reset();
              }}
            >
              <div className="space-y-2"><Label>Nome do grupo</Label><Input required placeholder="Ex.: Turma Liderança 2026.1" /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select defaultValue="turma">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="turma">Turma</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                    <SelectItem value="setor">Setor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Input placeholder="Contexto ou objetivo da campanha" /></div>
              <DialogFooter><Button type="submit">Criar grupo</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
              <th className="px-6 py-3 font-medium text-muted-foreground">Criado em</th>
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
                    {GROUP_TYPE_LABEL[g.type]}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{g.peopleCount}</td>
                <td className="px-6 py-4 text-muted-foreground">{new Date(g.createdAt).toLocaleDateString("pt-BR")}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => toast.info("Envio em lote (demo)")}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <Send className="size-3" /> Enviar teste
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">Nenhum grupo encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}