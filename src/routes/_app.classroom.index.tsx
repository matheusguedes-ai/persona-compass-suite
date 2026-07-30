/**
 * Classroom — o catálogo de treinamentos PRESENCIAIS do master.
 *
 * Menu só do dono da conta, como os eventos da agenda: as policies de escrita
 * exigem `mentor_id = auth.uid()`. A tela do aluno é /aluno/classroom.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTreinamentos, createTreinamento } from "@/lib/classroom.functions";
import {
  PrateleiraTreinamentos, ClassroomVazio, type TreinamentoCard,
} from "@/components/classroom-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/classroom/")({
  head: () => ({
    meta: [
      { title: "Classroom — Métrica Humana" },
      { name: "description", content: "Treinamentos presenciais: turmas, aulas, materiais e presença." },
    ],
  }),
  component: ClassroomPage,
});

function ClassroomPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");

  const listFn = useServerFn(listTreinamentos);
  const createFn = useServerFn(createTreinamento);
  const { data: treinamentos = [], isLoading } = useQuery({
    queryKey: ["treinamentos"],
    queryFn: () => listFn(),
  });

  const criar = useMutation({
    mutationFn: () => createFn({ data: { titulo: titulo.trim(), descricao: descricao.trim() || null } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["treinamentos"] });
      setAberto(false); setTitulo(""); setDescricao("");
      toast.success("Treinamento criado — agora monte os módulos e as aulas");
      nav({ to: "/classroom/$treinamentoId", params: { treinamentoId: (row as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = treinamentos as TreinamentoCard[];
  const publicados = lista.filter((t) => t.publicado);
  const rascunhos = lista.filter((t) => !t.publicado);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Classroom</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Treinamentos presenciais: módulos, aulas com data e local, e os materiais de cada
            encontro. O check-in por QR code e a lista de presença vêm nas próximas etapas.
          </p>
        </div>
        <Button onClick={() => setAberto(true)}><Plus className="size-4" /> Novo treinamento</Button>
      </div>

      {lista.length === 0 ? (
        <ClassroomVazio podeEditar />
      ) : (
        <div className="space-y-8">
          <PrateleiraTreinamentos
            titulo="Publicados" ajuda="Já aparecem para os grupos que você escolheu."
            treinamentos={publicados} base="/classroom"
          />
          <PrateleiraTreinamentos
            titulo="Rascunhos" ajuda="Só você enxerga."
            treinamentos={rascunhos} base="/classroom"
          />
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo treinamento</DialogTitle>
            <DialogDescription>
              Comece pelo nome. Ele nasce como rascunho — nenhum aluno vê até você publicar para
              um grupo.
            </DialogDescription>
          </DialogHeader>
          <form
            id="form-treinamento"
            onSubmit={(e) => { e.preventDefault(); criar.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome do treinamento</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={2} maxLength={200} placeholder="Ex.: Imersão Método Intenção — Turma 3" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={2000} placeholder="Do que se trata e para quem é." />
            </div>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" form="form-treinamento" disabled={criar.isPending}>
              {criar.isPending ? "Criando…" : "Criar treinamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
