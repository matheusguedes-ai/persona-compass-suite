import { mensagemDeErro } from "@/lib/erro-legivel";
import { BannersAcademy } from "@/components/banners-academy";
import { Biblioteca } from "@/components/biblioteca";
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
import {
  ChevronDown, Folder, GraduationCap, Image as ImageIcon, Paperclip, Plus,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuemAcessa } from "@/components/quem-acessa";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/educacao/")({
  head: () => ({
    meta: [
      { title: "Academy — Métrica Humana" },
      { name: "description", content: "Trilhas, módulos e aulas para a sua equipe e seus alunos." },
      { property: "og:title", content: "Academy — Métrica Humana" },
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
  const [grupos, setGrupos] = useState<string[]>([]);
  const [pessoas, setPessoas] = useState<string[]>([]);
  // Os diálogos da biblioteca e dos banners moram nos filhos; o menu "Criar"
  // mora aqui. Por isso a abertura sobe para esta tela.
  const [novoMaterial, setNovoMaterial] = useState(false);
  const [novaPasta, setNovaPasta] = useState(false);
  const [novoBanner, setNovoBanner] = useState(false);

  const listFn = useServerFn(listTracks);
  const createFn = useServerFn(createTrack);
  const { data: trilhas = [], isLoading } = useQuery({
    queryKey: ["tracks", null], queryFn: () => listFn({ data: {} }),
  });

  const criar = useMutation({
    mutationFn: () => createFn({
      data: {
        title: title.trim(), description: description.trim() || null, audience, is_published: false,
        // Público só da equipe não tem aluno para trancar.
        group_ids: audience === "equipe" ? [] : grupos,
        person_ids: audience === "equipe" ? [] : pessoas,
      },
    }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["tracks"] });
      setAberto(false); setTitle(""); setDescription(""); setGrupos([]); setPessoas([]);
      toast.success("Trilha criada — agora monte os módulos e as aulas");
      nav({ to: "/educacao/$trackId", params: { trackId: (row as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const lista = trilhas as TrackCard[];
  const publicadas = lista.filter((t) => t.is_published);
  const rascunhos = lista.filter((t) => !t.is_published);

  return (
    <div className="space-y-8">
      {/* O cabeçalho fecha AQUI. Antes os banners e a biblioteca ficavam dentro
          deste flex, viravam itens da mesma linha do título e apareciam
          espremidos ao lado do botão. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Academy</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Trilhas com módulos, submódulos e aulas. O vídeo entra por link do YouTube e os materiais por
            link (Google Drive, por exemplo).
          </p>
        </div>

        {/* Um botão só, com o menu abrindo por CLIQUE — hover não existe no
            celular, e metade do uso é por lá. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button><Plus className="size-4" /> Criar <ChevronDown className="size-3.5 opacity-70" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {/* `onSelect` com preventDefault: sem isso o Radix fecha o menu,
                desmonta o gatilho e o diálogo fecha junto. */}
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAberto(true); }}>
              <GraduationCap className="size-4" />
              <div>
                <p className="text-sm">Criar trilha</p>
                <p className="text-[11px] text-muted-foreground">Curso com módulos e aulas</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setNovaPasta(true); }}>
              <Folder className="size-4" />
              <div>
                <p className="text-sm">Criar pasta</p>
                <p className="text-[11px] text-muted-foreground">Para agrupar materiais</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setNovoMaterial(true); }}>
              <Paperclip className="size-4" />
              <div>
                <p className="text-sm">Criar material</p>
                <p className="text-[11px] text-muted-foreground">PDF, planilha, imagem, link…</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setNovoBanner(true); }}>
              <ImageIcon className="size-4" />
              <div>
                <p className="text-sm">Criar banner</p>
                <p className="text-[11px] text-muted-foreground">Faixa do topo da Academy</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <BannersAcademy podeEditar novo={novoBanner} onNovo={setNovoBanner} />

      <Biblioteca
        podeEditar
        novoMaterial={novoMaterial} onNovoMaterial={setNovoMaterial}
        novaPasta={novaPasta} onNovaPasta={setNovaPasta}
      />

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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
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
            {audience !== "equipe" && (
              <QuemAcessa
                grupos={grupos} pessoas={pessoas}
                setGrupos={setGrupos} setPessoas={setPessoas} ativo={aberto}
              />
            )}
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
