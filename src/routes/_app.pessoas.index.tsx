import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ROLE_LABEL, type PersonRole } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { ImportarPlanilha } from "@/components/importar-planilha";
import { ExportarPessoas } from "@/components/exportar-pessoas";
import { Avatar } from "@/components/avatar-upload";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPeople, createPerson } from "@/lib/data.functions";

export const Route = createFileRoute("/_app/pessoas/")({
  head: () => ({
    meta: [
      { title: "Pessoas — Métrica Humana" },
      { name: "description", content: "Gestão de clientes, alunos e colaboradores avaliados." },
      { property: "og:title", content: "Pessoas — Métrica Humana" },
      { property: "og:description", content: "Gestão de clientes, alunos e colaboradores avaliados." },
    ],
  }),
  component: PessoasPage,
});

function PessoasPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | PersonRole>("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    profession: "",
    role_at_company: "",
    role: "cliente" as PersonRole,
    notes: "",
  });
  function resetForm() {
    setForm({ full_name: "", email: "", phone: "", profession: "", role_at_company: "", role: "cliente", notes: "" });
  }
  const qc = useQueryClient();
  const listFn = useServerFn(listPeople);
  const createFn = useServerFn(createPerson);
  const { data: people = [], isLoading } = useQuery({ queryKey: ["people"], queryFn: () => listFn() });
  const create = useMutation({
    mutationFn: (data: {
      full_name: string; email: string; phone: string | null;
      profession: string | null; role_at_company: string | null;
      role: PersonRole; notes: string | null;
    }) => createFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
      toast.success("Pessoa cadastrada");
      setOpen(false);
      resetForm();
    },
    onError: (e: unknown) => toast.error(mensagemDeErro(e, undefined, "Falha ao cadastrar.")),
  });
  const list = people.filter((p) => {
    const okQ = p.full_name.toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().includes(q.toLowerCase());
    const okR = filter === "todos" || p.role === filter;
    return okQ && okR;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestão de Pessoas</h1>
          <p className="mt-1 text-sm text-muted-foreground">{people.length} pessoas cadastradas</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <ImportarPlanilha />
        <ExportarPessoas pessoas={people.map((p) => ({ id: p.id, full_name: p.full_name }))} />
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4" /> Adicionar pessoa</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova pessoa</DialogTitle>
              <DialogDescription>Cadastre um avaliado para depois enviar testes.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.full_name.trim() || !form.email.trim()) return;
                create.mutate({
                  full_name: form.full_name.trim(),
                  email: form.email.trim(),
                  phone: form.phone.trim() || null,
                  profession: form.profession.trim() || null,
                  role_at_company: form.role_at_company.trim() || null,
                  role: form.role,
                  notes: form.notes.trim() || null,
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-2"><Label>Nome completo</Label><Input required autoComplete="off" placeholder="Ex.: Maria da Silva" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Email</Label><Input required type="email" autoComplete="off" placeholder="maria@empresa.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Telefone (celular)</Label><Input autoComplete="off" placeholder="(11) 99999-0000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Profissão</Label><Input autoComplete="off" placeholder="Ex.: Psicóloga" value={form.profession} onChange={(e) => setForm((f) => ({ ...f, profession: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Cargo</Label><Input autoComplete="off" placeholder="Ex.: Gerente de RH" value={form.role_at_company} onChange={(e) => setForm((f) => ({ ...f, role_at_company: e.target.value }))} /></div>
                <div className="col-span-2 space-y-2">
                  <Label>Papel</Label>
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as PersonRole }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="aluno">Aluno</SelectItem>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea rows={3} placeholder="Notas internas sobre a pessoa" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Salvando…" : "Cadastrar"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md bg-muted px-3 py-1.5 ring-1 ring-black/5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou email"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os papéis</SelectItem>
            <SelectItem value="cliente">Clientes</SelectItem>
            <SelectItem value="aluno">Alunos</SelectItem>
            <SelectItem value="colaborador">Colaboradores</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-black/5">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-black/5 bg-muted/50">
            <tr>
              <th className="px-6 py-3 font-medium text-muted-foreground">Nome</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Email</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Telefone</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Papel</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {list.map((p) => (
              <tr key={p.id} className="hover:bg-muted/40">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar url={p.avatar_url} nome={p.full_name} size={32} />
                    <span className="font-medium">{p.full_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{p.email}</td>
                <td className="px-6 py-4 text-muted-foreground">{p.phone ?? "—"}</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-black/5">
                    {ROLE_LABEL[p.role as PersonRole]}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link to="/pessoas/$id" params={{ id: p.id }} className="text-xs font-medium text-accent hover:underline">
                    Ver perfil
                  </Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                {isLoading ? "Carregando…" : "Ninguém encontrado."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}