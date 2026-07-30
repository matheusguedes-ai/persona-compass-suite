/**
 * Classroom — o catálogo de treinamentos PRESENCIAIS do master.
 *
 * Menu só do dono da conta, como os eventos da agenda: as policies de escrita
 * exigem `mentor_id = auth.uid()`. A tela do aluno é a etapa 3 do plano
 * (docs/analise-classroom.md).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTreinamentos, createTreinamento } from "@/lib/classroom.functions";
import { corDoTitulo } from "@/components/learning-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Lock, Plus, Presentation } from "lucide-react";
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

type TreinamentoCard = {
  id: string; titulo: string; descricao: string | null; capa_url: string | null;
  publicado: boolean; aulas_count: number; grupos_count: number;
};

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
        <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
          <Presentation className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-base font-medium">Nenhum treinamento ainda</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Crie o primeiro, organize os encontros em módulos e aulas, e escolha os grupos que
            participam.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <PrateleiraT
            titulo="Publicados" ajuda="Já aparecem para os grupos que você escolheu."
            treinamentos={publicados}
          />
          <PrateleiraT
            titulo="Rascunhos" ajuda="Só você enxerga."
            treinamentos={rascunhos}
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

function PrateleiraT({
  titulo, ajuda, treinamentos,
}: { titulo: string; ajuda?: string; treinamentos: TreinamentoCard[] }) {
  if (treinamentos.length === 0) return null;
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-medium tracking-tight">{titulo}</h2>
        {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {treinamentos.map((t) => (
          <Link
            key={t.id}
            to="/classroom/$treinamentoId"
            params={{ treinamentoId: t.id }}
            className="group relative block w-60 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5 transition hover:ring-2 hover:ring-primary"
          >
            <div className="relative h-32 w-full" style={{ background: corDoTitulo(t.titulo) }}>
              {t.capa_url && (
                <img src={t.capa_url} alt="" className="absolute inset-0 size-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <Presentation className="absolute inset-0 m-auto size-10 text-white/0 transition group-hover:text-white/90" />
              {!t.publicado && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  <Lock className="size-2.5" /> rascunho
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{t.titulo}</p>
              </div>
            </div>
            <div className="bg-card p-3">
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {t.descricao || "Sem descrição."}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                {t.aulas_count} aula{t.aulas_count === 1 ? "" : "s"} · {t.grupos_count} grupo{t.grupos_count === 1 ? "" : "s"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
