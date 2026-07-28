import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTracks, createTrack, PUBLICOS } from "@/lib/learning.functions";
import { Prateleira, CatalogoVazio, type TrackCard } from "@/components/learning-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/educacao/")({
  head: () => ({
    meta: [
      { title: "Educação — Métrica Humana" },
      { name: "description", content: "Trilhas, módulos e aulas para a sua equipe e seus alunos." },
      { property: "og:title", content: "Educação — Métrica Humana" },
      { property: "og:description", content: "Plataforma de aulas e materiais." },
    ],
  }),
  component: EducacaoPage,
});

function EducacaoPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<"equipe" | "alunos" | "ambos">("alunos");

  const listFn = useServerFn(listTracks);
  const createFn = useServerFn(createTrack);
  const { data: trilhas = [], isLoading } = useQuery({ queryKey: ["tracks"], queryFn: () => listFn() });

  const criar = useMutation({
    mutationFn: () => createFn({ data: { title: title.trim(), description: description.trim() || null, audience, is_published: false } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["tracks"] });
      setAberto(false); setTitle(""); setDescription("");
      toast.success("Trilha criada — agora monte os módulos e as aulas");
      nav({ to: "/educacao/$trackId", params: { trackId: (row as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = trilhas as TrackCard[];
  const publicadas = lista.filter((t) => t.is_published);
  const rascunhos = lista.filter((t) => !t.is_published);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Educação</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Trilhas com módulos, submódulos e aulas. O vídeo entra por link do YouTube e os materiais por
            link (Google Drive, por exemplo).
          </p>
        </div>
        <Button onClick={() => setAberto(true)}><Plus className="size-4" /> Nova trilha</Button>
      </div>

      {lista.length === 0 ? (
        <CatalogoVazio podeEditar />
      ) : (
        <div className="space-y-8">
          <Prateleira
            titulo="Publicadas" ajuda="Já aparecem para quem você escolheu."
            trilhas={publicadas} base="/educacao"
          />
          <Prateleira
            titulo="Rascunhos" ajuda="Só você e sua equipe enxergam."
            trilhas={rascunhos} base="/educacao"
          />
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova trilha</DialogTitle>
            <DialogDescription>
              Comece pelo nome. Ela nasce como rascunho — nada aparece para ninguém até você publicar.
            </DialogDescription>
          </DialogHeader>
          <form
            id="form-trilha"
            onSubmit={(e) => { e.preventDefault(); criar.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome da trilha</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={200} placeholder="Ex.: Fundamentos do Método Intenção" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} placeholder="Do que se trata e para quem é." />
            </div>
            <div className="space-y-2">
              <Label>Quem vai assistir</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {PUBLICOS.map((p) => (
                  <button
                    key={p.valor} type="button" onClick={() => setAudience(p.valor)}
                    className={`rounded-lg border p-3 text-left transition ${
                      audience === p.valor ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-black/10 hover:bg-muted/40"
                    }`}
                  >
                    <p className="text-sm font-medium">{p.titulo}</p>
                    <p className="text-[11px] text-muted-foreground">{p.ajuda}</p>
                  </button>
                ))}
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" form="form-trilha" disabled={criar.isPending}>
              {criar.isPending ? "Criando…" : "Criar trilha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
