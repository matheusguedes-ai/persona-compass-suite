/**
 * #313 — A Biblioteca do painel: menu próprio, fora da Academy. Pastas até 3 níveis, material por
 * arquivo ou link, e o acesso de cada item à vista ("não liberado para ninguém" / "N pessoas veem"),
 * com a lista final em "Quem vê isto". Tudo o que diz quem vê vem do banco (`bib_decide`).
 *
 * `?pasta=<id>` é a pasta aberta — o endereço pode ser guardado e compartilhado entre a equipe.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, Folder, FolderInput, FolderPlus,
  Library, Loader2, MoreVertical, Pencil, Plus, Search, ShieldBan, Trash2, Users, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erro-legivel";
import {
  listarAcervo, abrirMaterialDaBiblioteca, apagarPastaDoAcervo, excluirMaterial, moverMaterialDoAcervo,
  moverPastaDoAcervo, reordenarPastaDoAcervo, ROTULO_TIPO, type AcessoResumido,
} from "@/lib/biblioteca.functions";
import {
  MAX_NIVEIS, abrirEmNovaAba, agruparPorTipo, alturaDe, caminhoAte, descendentesDe, emOrdemDeArvore, filhasDe, iconeDoTipo,
} from "@/components/biblioteca/arvore";
import { FormularioMaterial, FormularioPasta, type MaterialEditavel, type PastaEditavel } from "@/components/biblioteca/formularios";
import { DialogoMenu, DialogoQuemVe, DialogoRegras, SeloDeAcesso, type Alvo } from "@/components/biblioteca/acesso";

export const Route = createFileRoute("/_app/biblioteca")({
  // Opcional de verdade: sem `pasta` é o início da Biblioteca — o menu e os links não precisam passá-la.
  validateSearch: (s: Record<string, unknown>): { pasta?: string } => ({
    pasta: typeof s.pasta === "string" ? s.pasta : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Biblioteca — Métrica Humana" },
      { name: "description", content: "Acervo técnico em pastas, com acesso por grupo e por pessoa." },
    ],
  }),
  component: BibliotecaGestao,
});

type Pasta = {
  id: string; titulo: string; descricao: string | null; capa_url: string | null; ordem: number;
  pasta_mae_id: string | null; created_at: string; acesso: AcessoResumido;
};
type Material = MaterialEditavel & { created_at: string; acesso: AcessoResumido };
type Selecao = { alvo: Alvo; id: string; titulo: string };

function BibliotecaGestao() {
  const { pasta: pastaAtualId } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listaFn = useServerFn(listarAcervo);
  const { data, isLoading, error } = useQuery({ queryKey: ["biblioteca-acervo"], queryFn: () => listaFn() });
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["biblioteca-acervo"] });
    qc.invalidateQueries({ queryKey: ["biblioteca-quem-ve"] });
    qc.invalidateQueries({ queryKey: ["biblioteca-regras"] });
  };

  const pastas = (data?.pastas ?? []) as Pasta[];
  const materiais = (data?.materiais ?? []) as Material[];
  const podeEditar = data?.podeEditar ?? false;
  const pastaAtual = pastaAtualId ? pastas.find((p) => p.id === pastaAtualId) ?? null : null;
  const caminho = caminhoAte(pastas, pastaAtual?.id ?? null);
  const nivelAtual = pastaAtual ? caminho.length : 0;

  const [busca, setBusca] = useState("");
  const [formPasta, setFormPasta] = useState<{ aberto: boolean; inicial: PastaEditavel | null }>({ aberto: false, inicial: null });
  const [formMaterial, setFormMaterial] = useState<{ aberto: boolean; inicial: MaterialEditavel | null }>({ aberto: false, inicial: null });
  const [quemVe, setQuemVe] = useState<Selecao | null>(null);
  const [regras, setRegras] = useState<Selecao | null>(null);
  const [mover, setMover] = useState<Selecao | null>(null);
  const [apagar, setApagar] = useState<Selecao | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [criarAberto, setCriarAberto] = useState(false);

  const abrirFn = useServerFn(abrirMaterialDaBiblioteca);
  const reordenarFn = useServerFn(reordenarPastaDoAcervo);
  const reordenar = useMutation({
    mutationFn: (v: { id: string; direcao: "cima" | "baixo" }) => reordenarFn({ data: v }),
    onSuccess: recarregar,
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const irPara = (id: string | null) => {
    setBusca("");
    navigate({ to: "/biblioteca", search: { pasta: id ?? undefined } });
  };
  const abrir = (m: Material) =>
    abrirEmNovaAba(async () => (await abrirFn({ data: { id: m.id } })).url).catch((e) => toast.error(mensagemDeErro(e)));

  const filhas = filhasDe(pastas, pastaAtual?.id ?? null);
  const aqui = materiais.filter((m) => (m.pasta_id ?? null) === (pastaAtual?.id ?? null));
  const termo = busca.trim().toLowerCase();
  const achados = termo
    ? materiais.filter((m) =>
        [m.titulo, m.descricao ?? "", m.categoria ?? ""].some((t) => t.toLowerCase().includes(termo)))
    : [];
  const nenhumLiberado = materiais.length > 0 && materiais.every((m) => m.acesso.veem === 0);
  const semLiberacao = materiais.filter((m) => m.acesso.veem === 0).length;
  const nomeDoGrupo = new Map((data?.grupos ?? []).map((g) => [g.id, g.name]));
  const quantasPorPasta = (id: string) => {
    const dentro = descendentesDe(pastas, id);
    return {
      subpastas: pastas.filter((p) => p.pasta_mae_id === id).length,
      materiais: materiais.filter((m) => m.pasta_id && dentro.has(m.pasta_id)).length,
    };
  };

  if (error) {
    return (
      <div className="rounded-xl bg-destructive/10 p-6 text-sm text-destructive">{mensagemDeErro(error)}</div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Library className="size-6 text-muted-foreground" /> Biblioteca
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acervo técnico em pastas. Cada item mostra quem vê — e "Quem vê isto" dá a lista final, pessoa a pessoa.
          </p>
        </div>
        {podeEditar && (
          <DropdownMenu open={criarAberto} onOpenChange={setCriarAberto}>
            <DropdownMenuTrigger asChild>
              <Button className="h-10"><Plus className="size-4" /> Criar <ChevronDown className="size-3.5 opacity-70" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                disabled={nivelAtual >= MAX_NIVEIS}
                onSelect={() => { setCriarAberto(false); setFormPasta({ aberto: true, inicial: null }); }}>
                <FolderPlus className="size-4" />
                <div>
                  <p className="text-sm">{pastaAtual ? "Subpasta aqui" : "Pasta"}</p>
                  {nivelAtual >= MAX_NIVEIS && <p className="text-[11px] text-muted-foreground">Limite de {MAX_NIVEIS} níveis</p>}
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { setCriarAberto(false); setFormMaterial({ aberto: true, inicial: null }); }}>
                <Plus className="size-4" />
                <p className="text-sm">{pastaAtual ? "Material nesta pasta" : "Material"}</p>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Camada 1: o menu por grupo */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-4 ring-1 ring-black/5 dark:ring-white/10">
        <Users className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">Menu Biblioteca liberado para:</p>
        {(data?.menuGrupos ?? []).length === 0 ? (
          <span className="text-sm text-muted-foreground">nenhum grupo — fechado para todos</span>
        ) : (
          (data?.menuGrupos ?? []).map((gid) => (
            <span key={gid} className="rounded-full bg-muted px-2.5 py-1 text-xs">{nomeDoGrupo.get(gid) ?? "grupo"}</span>
          ))
        )}
        {podeEditar && (
          <Button variant="outline" size="sm" className="ml-auto h-9" onClick={() => setMenuAberto(true)}>Escolher grupos</Button>
        )}
      </div>

      {!isLoading && semLiberacao > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            {nenhumLiberado
              ? `Nenhum dos ${materiais.length} materiais está liberado para ninguém — hoje nenhum aluno vê a Biblioteca.`
              : `${semLiberacao} ${semLiberacao === 1 ? "material não está liberado" : "materiais não estão liberados"} para ninguém.`}
            {" "}Para liberar: dê o menu a um grupo (acima) ou use "Liberar ou bloquear" numa pasta ou material.
          </p>
        </div>
      )}

      {/* Onde estou — só dentro de uma pasta: no início, o título da página já diz. */}
      {pastaAtual && <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Caminho">
        <button type="button" onClick={() => irPara(null)}
          className="min-h-9 rounded-md px-2 hover:bg-muted">
          Biblioteca
        </button>
        {caminho.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <button type="button" onClick={() => irPara(p.id)}
              className={cn("min-h-9 rounded-md px-2 hover:bg-muted", p.id === pastaAtual.id && "font-semibold")}>
              {p.titulo}
            </button>
          </span>
        ))}
      </nav>}

      {pastaAtualId && !pastaAtual && !isLoading && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Pasta não encontrada. <button className="underline" onClick={() => irPara(null)}>Voltar ao início da Biblioteca</button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar em toda a Biblioteca"
          className="h-10 pl-9" />
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</p>
      ) : termo ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{achados.length} resultado{achados.length === 1 ? "" : "s"}</h2>
          {achados.map((m) => (
            <LinhaMaterial key={m.id} m={m} onde={caminhoAte(pastas, m.pasta_id).map((p) => p.titulo).join(" › ") || "Início da Biblioteca"}
              podeEditar={podeEditar} onAbrir={() => abrir(m)} onQuemVe={() => setQuemVe({ alvo: "material", id: m.id, titulo: m.titulo })}
              onRegras={() => setRegras({ alvo: "material", id: m.id, titulo: m.titulo })}
              onEditar={() => setFormMaterial({ aberto: true, inicial: m })}
              onMover={() => setMover({ alvo: "material", id: m.id, titulo: m.titulo })}
              onApagar={() => setApagar({ alvo: "material", id: m.id, titulo: m.titulo })} />
          ))}
        </section>
      ) : (
        <>
          {filhas.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">{pastaAtual ? "Subpastas" : "Pastas"}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {filhas.map((p, i) => {
                  const q = quantasPorPasta(p.id);
                  return (
                    <li key={p.id} className="rounded-xl bg-card p-3 ring-1 ring-black/5 dark:ring-white/10">
                      <div className="flex items-start gap-2">
                        <button type="button" onClick={() => irPara(p.id)} className="flex min-h-11 min-w-0 flex-1 items-start gap-3 text-left">
                          <Folder className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 space-y-1">
                            <p className="line-clamp-2 text-sm font-medium">{p.titulo}</p>
                            <p className="text-xs text-muted-foreground">
                              {q.materiais} {q.materiais === 1 ? "material" : "materiais"}{q.subpastas ? ` · ${q.subpastas} subpasta${q.subpastas === 1 ? "" : "s"}` : ""}
                            </p>
                          </div>
                        </button>
                        <MenuDeAcoes podeEditar={podeEditar} titulo={p.titulo}
                          onAbrir={() => irPara(p.id)}
                          onQuemVe={() => setQuemVe({ alvo: "pasta", id: p.id, titulo: p.titulo })}
                          onRegras={() => setRegras({ alvo: "pasta", id: p.id, titulo: p.titulo })}
                          onEditar={() => setFormPasta({ aberto: true, inicial: p })}
                          onMover={() => setMover({ alvo: "pasta", id: p.id, titulo: p.titulo })}
                          onSubir={i > 0 ? () => reordenar.mutate({ id: p.id, direcao: "cima" }) : undefined}
                          onDescer={i < filhas.length - 1 ? () => reordenar.mutate({ id: p.id, direcao: "baixo" }) : undefined}
                          onApagar={() => setApagar({ alvo: "pasta", id: p.id, titulo: p.titulo })} />
                      </div>
                      <div className="mt-1 pl-8">
                        <SeloDeAcesso acesso={p.acesso} onClick={() => setQuemVe({ alvo: "pasta", id: p.id, titulo: p.titulo })} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              {pastaAtual ? "Materiais desta pasta" : "Materiais fora de pasta"}
            </h2>
            {aqui.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {pastaAtual ? "Nenhum material nesta pasta." : filhas.length ? "Todos os materiais estão dentro de pastas." : "Nada aqui ainda."}
              </p>
            ) : (
              agruparPorTipo(aqui).map(([tipo, itens]) => (
                <div key={tipo} className="space-y-2">
                  <p className="pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {ROTULO_TIPO[tipo] ?? tipo} · {itens.length}
                  </p>
                  {itens.map((m) => (
                    <LinhaMaterial key={m.id} m={m} podeEditar={podeEditar} onAbrir={() => abrir(m)}
                      onQuemVe={() => setQuemVe({ alvo: "material", id: m.id, titulo: m.titulo })}
                      onRegras={() => setRegras({ alvo: "material", id: m.id, titulo: m.titulo })}
                      onEditar={() => setFormMaterial({ aberto: true, inicial: m })}
                      onMover={() => setMover({ alvo: "material", id: m.id, titulo: m.titulo })}
                      onApagar={() => setApagar({ alvo: "material", id: m.id, titulo: m.titulo })} />
                  ))}
                </div>
              ))
            )}
          </section>
        </>
      )}

      <FormularioPasta aberto={formPasta.aberto} inicial={formPasta.inicial}
        onFechar={() => setFormPasta({ aberto: false, inicial: null })}
        maeId={pastaAtual?.id ?? null} nomeDaMae={pastaAtual?.titulo ?? null} onSalvo={recarregar} />
      <FormularioMaterial aberto={formMaterial.aberto} inicial={formMaterial.inicial}
        onFechar={() => setFormMaterial({ aberto: false, inicial: null })}
        pastaPadrao={pastaAtual?.id ?? null} pastas={pastas} onSalvo={recarregar} />
      <DialogoQuemVe aberto={!!quemVe} onFechar={() => setQuemVe(null)} alvo={quemVe?.alvo ?? "material"} id={quemVe?.id ?? null} titulo={quemVe?.titulo ?? ""} />
      <DialogoRegras aberto={!!regras} onFechar={() => setRegras(null)} alvo={regras?.alvo ?? "material"} id={regras?.id ?? null}
        titulo={regras?.titulo ?? ""} onSalvo={recarregar} />
      <DialogoMenu aberto={menuAberto} onFechar={() => setMenuAberto(false)} atuais={data?.menuGrupos ?? []} onSalvo={recarregar} />
      <DialogoMover selecao={mover} onFechar={() => setMover(null)} pastas={pastas} materiais={materiais} onMovido={recarregar} />
      <DialogoApagar selecao={apagar} onFechar={() => setApagar(null)} pastas={pastas} materiais={materiais}
        onApagado={(eraPastaAtual) => { recarregar(); if (eraPastaAtual) irPara(pastaAtual?.pasta_mae_id ?? null); }}
        pastaAtualId={pastaAtual?.id ?? null} />
    </div>
  );
}

function MenuDeAcoes({
  podeEditar, titulo, onAbrir, onQuemVe, onRegras, onEditar, onMover, onSubir, onDescer, onApagar,
}: {
  podeEditar: boolean; titulo: string; onAbrir: () => void; onQuemVe: () => void; onRegras: () => void;
  onEditar: () => void; onMover: () => void; onSubir?: () => void; onDescer?: () => void; onApagar: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10" aria-label={`Ações de ${titulo}`}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onAbrir}><ExternalLink className="size-4" /> Abrir</DropdownMenuItem>
        <DropdownMenuItem onSelect={onQuemVe}><Eye className="size-4" /> Quem vê isto</DropdownMenuItem>
        {podeEditar && (
          <>
            <DropdownMenuItem onSelect={onRegras}><ShieldBan className="size-4" /> Liberar ou bloquear…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onEditar}><Pencil className="size-4" /> Editar</DropdownMenuItem>
            <DropdownMenuItem onSelect={onMover}><FolderInput className="size-4" /> Mover para…</DropdownMenuItem>
            {onSubir && <DropdownMenuItem onSelect={onSubir}><ArrowUp className="size-4" /> Subir</DropdownMenuItem>}
            {onDescer && <DropdownMenuItem onSelect={onDescer}><ArrowDown className="size-4" /> Descer</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onApagar} className="text-destructive focus:text-destructive">
              <Trash2 className="size-4" /> Apagar…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LinhaMaterial({
  m, onde, podeEditar, onAbrir, onQuemVe, onRegras, onEditar, onMover, onApagar,
}: {
  m: Material; onde?: string; podeEditar: boolean; onAbrir: () => void; onQuemVe: () => void; onRegras: () => void;
  onEditar: () => void; onMover: () => void; onApagar: () => void;
}) {
  const Icone = iconeDoTipo(m.kind);
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-black/5 dark:ring-white/10">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onAbrir} className="flex min-h-11 min-w-0 flex-1 items-start gap-3 text-left" title="Abrir">
          {m.capa_url ? (
            <img src={m.capa_url} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />
          ) : (
            <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-muted"><Icone className="size-5 text-muted-foreground" /></span>
          )}
          <div className="min-w-0 space-y-0.5">
            <p className="line-clamp-2 text-sm font-medium">{m.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {ROTULO_TIPO[m.kind] ?? m.kind}{m.categoria ? ` · ${m.categoria}` : ""}{onde ? ` · ${onde}` : ""}
            </p>
          </div>
        </button>
        <MenuDeAcoes podeEditar={podeEditar} titulo={m.titulo} onAbrir={onAbrir} onQuemVe={onQuemVe}
          onRegras={onRegras} onEditar={onEditar} onMover={onMover} onApagar={onApagar} />
      </div>
      <div className="mt-1 pl-[76px]">
        <SeloDeAcesso acesso={m.acesso} onClick={onQuemVe} />
      </div>
    </div>
  );
}

/** Mover pasta ou material. Só oferece destinos que o banco aceita (3 níveis, sem ciclo) — e ele confere de novo. */
function DialogoMover({
  selecao, onFechar, pastas, materiais, onMovido,
}: { selecao: Selecao | null; onFechar: () => void; pastas: Pasta[]; materiais: Material[]; onMovido: () => void }) {
  const moverPastaFn = useServerFn(moverPastaDoAcervo);
  const moverMaterialFn = useServerFn(moverMaterialDoAcervo);
  const [destino, setDestino] = useState<string | null | undefined>(undefined);
  const ehPasta = selecao?.alvo === "pasta";
  const atual = ehPasta
    ? pastas.find((p) => p.id === selecao?.id)?.pasta_mae_id ?? null
    : materiais.find((m) => m.id === selecao?.id)?.pasta_id ?? null;
  const bloqueados = useMemo(() => (ehPasta && selecao ? descendentesDe(pastas, selecao.id) : new Set<string>()), [ehPasta, selecao, pastas]);
  const altura = ehPasta && selecao ? alturaDe(pastas, selecao.id) : 0;
  const opcoes = emOrdemDeArvore(pastas).map(({ pasta, nivel }) => {
    const motivo = bloqueados.has(pasta.id)
      ? "é ela mesma ou está dentro dela"
      : ehPasta && nivel + altura > MAX_NIVEIS
        ? `passaria de ${MAX_NIVEIS} níveis`
        : null;
    return { pasta, nivel, motivo };
  });
  const mover = useMutation({
    mutationFn: () => {
      const alvo = destino ?? null;
      return ehPasta
        ? moverPastaFn({ data: { id: selecao!.id, pasta_mae_id: alvo } })
        : moverMaterialFn({ data: { id: selecao!.id, pasta_id: alvo } });
    },
    onSuccess: () => { toast.success("Movido. O selo já mostra o acesso no lugar novo."); onMovido(); onFechar(); setDestino(undefined); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });
  return (
    <Dialog open={!!selecao} onOpenChange={(v) => { if (!v) { onFechar(); setDestino(undefined); } }}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mover "{selecao?.titulo}"</DialogTitle>
          <DialogDescription>
            No lugar novo, {ehPasta ? "a pasta (e o que está nela) passa" : "o material passa"} a seguir o acesso de lá. As
            liberações e bloqueios feitos no próprio item continuam valendo.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1">
          <OpcaoDestino rotulo="Início da Biblioteca" nivel={0} marcado={destino === null} atual={atual === null}
            onEscolher={() => setDestino(null)} />
          {opcoes.map(({ pasta, nivel, motivo }) => (
            <OpcaoDestino key={pasta.id} rotulo={pasta.titulo} nivel={nivel} motivo={motivo} atual={atual === pasta.id}
              marcado={destino === pasta.id} onEscolher={() => setDestino(pasta.id)} />
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={() => mover.mutate()} disabled={destino === undefined || destino === atual || mover.isPending}>
            {mover.isPending ? "Movendo…" : "Mover para cá"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpcaoDestino({
  rotulo, nivel, marcado, atual, motivo, onEscolher,
}: { rotulo: string; nivel: number; marcado: boolean; atual: boolean; motivo?: string | null; onEscolher: () => void }) {
  const desabilitado = !!motivo || atual;
  return (
    <li>
      <button type="button" disabled={desabilitado} onClick={onEscolher}
        style={{ paddingLeft: `${0.75 + nivel * 1}rem` }}
        className={cn(
          "flex min-h-10 w-full items-center gap-2 rounded-lg pr-3 text-left text-sm",
          marcado ? "bg-primary/10 font-medium" : "hover:bg-muted",
          desabilitado && "cursor-not-allowed opacity-50 hover:bg-transparent",
        )}>
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{rotulo}</span>
        {atual && <span className="text-[11px] text-muted-foreground">está aqui</span>}
        {motivo && <span className="text-[11px] text-muted-foreground">{motivo}</span>}
      </button>
    </li>
  );
}

/**
 * Apagar com aviso do que acontece com o conteúdo — nunca apagar material em silêncio. Pasta: só ela
 * some; o que está DIRETO nela sobe um nível (o que está dentro das subpastas vai junto com elas), e
 * o banco copia as regras dela para cada item que subiu, para ninguém ganhar nem perder acesso.
 */
function DialogoApagar({
  selecao, onFechar, pastas, materiais, onApagado, pastaAtualId,
}: {
  selecao: Selecao | null; onFechar: () => void; pastas: Pasta[]; materiais: Material[];
  onApagado: (eraPastaAtual: boolean) => void; pastaAtualId: string | null;
}) {
  const apagarPastaFn = useServerFn(apagarPastaDoAcervo);
  const excluirFn = useServerFn(excluirMaterial);
  const ehPasta = selecao?.alvo === "pasta";
  const pasta = ehPasta ? pastas.find((p) => p.id === selecao?.id) : undefined;
  const mae = pasta?.pasta_mae_id ? pastas.find((p) => p.id === pasta.pasta_mae_id) : undefined;
  const diretos = {
    materiais: ehPasta ? materiais.filter((m) => m.pasta_id === selecao?.id).length : 0,
    subpastas: ehPasta ? pastas.filter((p) => p.pasta_mae_id === selecao?.id).length : 0,
  };
  const partes = [
    diretos.materiais ? `${diretos.materiais} ${diretos.materiais === 1 ? "material" : "materiais"}` : null,
    diretos.subpastas ? `${diretos.subpastas} ${diretos.subpastas === 1 ? "subpasta" : "subpastas"}` : null,
  ].filter(Boolean).join(" e ");
  const destino = mae ? `a pasta "${mae.titulo}"` : "o início da Biblioteca";
  const apagar = useMutation({
    mutationFn: async () => {
      if (ehPasta) await apagarPastaFn({ data: { id: selecao!.id } });
      else await excluirFn({ data: { id: selecao!.id } });
    },
    onSuccess: () => {
      toast.success(ehPasta ? "Pasta apagada. O que estava nela subiu um nível, com o mesmo acesso." : "Material apagado.");
      onApagado(ehPasta && selecao?.id === pastaAtualId);
      onFechar();
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });
  return (
    <AlertDialog open={!!selecao} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar {ehPasta ? "a pasta" : "o material"} "{selecao?.titulo}"?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              {ehPasta ? (
                !partes ? (
                  <p>A pasta está vazia. Só ela será apagada.</p>
                ) : (
                  <>
                    <p>
                      Só a pasta é apagada — <strong>nenhum material</strong>. O que está direto nela ({partes}) vai
                      para {destino}{diretos.subpastas ? ", e cada subpasta leva junto o que tem dentro" : ""}.
                    </p>
                    <p>
                      E continua visível exatamente para quem vê hoje: as liberações e bloqueios desta pasta passam para
                      cada item que estava nela.
                    </p>
                  </>
                )
              ) : (
                <p>O material deixa de aparecer para todos. Esta ação não pode ser desfeita.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); apagar.mutate(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={apagar.isPending}>
            {apagar.isPending ? "Apagando…" : ehPasta ? "Apagar pasta" : "Apagar material"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
