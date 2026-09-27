/**
 * #313 — A Biblioteca do aluno: menu próprio, fora da Academy.
 *
 * Mostra SÓ o que o banco diz que esta pessoa vê (`bib_visiveis`, que passa por `bib_decide`). Item
 * bloqueado não aparece nem trancado, nem na busca — e o link de cada material é pedido no clique,
 * quando o banco confere de novo. Pasta bloqueada aberta pelo endereço cai em "não encontrada".
 *
 * Quem recebeu um material solto (ou uma subpasta) sem ter a pasta de cima vê o item no início da
 * Biblioteca: o que ele não vê não aparece nem como caminho.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Folder, Library, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erro-legivel";
import { abrirMaterialDaBiblioteca, minhaBiblioteca, ROTULO_TIPO } from "@/lib/biblioteca.functions";
import { abrirEmNovaAba, agruparPorTipo, caminhoAte, filhasDe, iconeDoTipo } from "@/components/biblioteca/arvore";

export const Route = createFileRoute("/aluno/biblioteca")({
  validateSearch: (s: Record<string, unknown>): { ver?: string; pasta?: string } => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
    pasta: typeof s.pasta === "string" ? s.pasta : undefined,
  }),
  head: () => ({ meta: [{ title: "Biblioteca" }, { name: "robots", content: "noindex" }] }),
  component: BibliotecaDoAluno,
});

type Pasta = {
  id: string; titulo: string; descricao: string | null; capa_url: string | null; ordem: number;
  pasta_mae_id: string | null; created_at: string;
};
type Material = {
  id: string; titulo: string; descricao: string | null; kind: string; categoria: string | null;
  capa_url: string | null; pasta_id: string | null; created_at: string;
};

function BibliotecaDoAluno() {
  const { ver, pasta: pastaId } = Route.useSearch();
  const navigate = useNavigate();
  const fn = useServerFn(minhaBiblioteca);
  const abrirFn = useServerFn(abrirMaterialDaBiblioteca);
  const { data, isLoading, error } = useQuery({
    queryKey: ["minha-biblioteca", ver ?? null],
    queryFn: () => fn({ data: { preview_person_id: ver ?? null } }),
  });
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);

  // Só o que ele vê. Uma pasta cuja mãe ele não vê começa no início da Biblioteca — assim como o
  // material solto liberado só para ele.
  const pastas = useMemo(() => {
    const lista = (data?.pastas ?? []) as Pasta[];
    const ids = new Set(lista.map((p) => p.id));
    return lista.map((p) => (p.pasta_mae_id && !ids.has(p.pasta_mae_id) ? { ...p, pasta_mae_id: null } : p));
  }, [data]);
  const materiais = useMemo(() => {
    const ids = new Set(pastas.map((p) => p.id));
    return ((data?.materiais ?? []) as Material[]).map((m) =>
      m.pasta_id && !ids.has(m.pasta_id) ? { ...m, pasta_id: null } : m);
  }, [data, pastas]);

  const pastaAtual = pastaId ? pastas.find((p) => p.id === pastaId) ?? null : null;
  const caminho = caminhoAte(pastas, pastaAtual?.id ?? null);
  const filhas = filhasDe(pastas, pastaAtual?.id ?? null);
  const aqui = materiais.filter((m) => (m.pasta_id ?? null) === (pastaAtual?.id ?? null));
  const termo = busca.trim().toLowerCase();
  const filtrando = !!termo || !!categoria;
  const achados = materiais.filter((m) =>
    (!categoria || m.categoria === categoria) &&
    (!termo || [m.titulo, m.descricao ?? "", m.categoria ?? ""].some((t) => t.toLowerCase().includes(termo))));

  const irPara = (id: string | null) => {
    setBusca("");
    setCategoria(null);
    navigate({ to: "/aluno/biblioteca", search: { ver, pasta: id ?? undefined } });
  };
  const abrir = (m: Material) =>
    abrirEmNovaAba(async () => (await abrirFn({ data: { id: m.id } })).url).catch((e) => toast.error(mensagemDeErro(e)));

  const quantos = (id: string) => materiais.filter((m) => m.pasta_id === id).length +
    pastas.filter((p) => p.pasta_mae_id === id).length;

  if (error) {
    return <div className="rounded-xl bg-destructive/10 p-6 text-sm text-destructive">{mensagemDeErro(error)}</div>;
  }

  const vazio = !isLoading && pastas.length === 0 && materiais.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Library className="size-6 text-muted-foreground" /> Biblioteca
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Material de apoio liberado para você.</p>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</p>
      ) : vazio ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {ver ? "Nada da Biblioteca está liberado para esta pessoa." : "Nenhum material foi liberado para você ainda."}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar material"
                className="h-10 pl-9" />
            </div>
            {(data?.categorias ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(data?.categorias ?? []).map((c) => (
                  <button key={c} type="button" onClick={() => setCategoria(categoria === c ? null : c)}
                    className={cn(
                      "min-h-9 rounded-full px-3 text-xs font-medium transition-colors",
                      categoria === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                    )}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filtrando ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {achados.length} resultado{achados.length === 1 ? "" : "s"}
              </h2>
              <Grade materiais={achados} onAbrir={abrir}
                ondeEsta={(m) => caminhoAte(pastas, m.pasta_id).map((p) => p.titulo).join(" › ")} />
            </section>
          ) : pastaId && !pastaAtual ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Esta pasta não foi encontrada.{" "}
              <button type="button" className="underline" onClick={() => irPara(null)}>Voltar ao início da Biblioteca</button>
            </div>
          ) : (
            <>
              {pastaAtual && (
                <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Caminho">
                  <button type="button" onClick={() => irPara(null)} className="min-h-9 rounded-md px-2 hover:bg-muted">
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
                </nav>
              )}
              {pastaAtual?.descricao && <p className="text-sm text-muted-foreground">{pastaAtual.descricao}</p>}

              {filhas.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {filhas.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => irPara(p.id)}
                        className="flex min-h-16 w-full items-center gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-black/5 hover:bg-muted/50 dark:ring-white/10">
                        {p.capa_url ? (
                          <img src={p.capa_url} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <Folder className="size-6 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.titulo}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {p.descricao || `${quantos(p.id)} ${quantos(p.id) === 1 ? "item" : "itens"}`}
                          </p>
                        </div>
                        <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {aqui.length > 0 ? (
                agruparPorTipo(aqui).map(([tipo, itens]) => (
                  <section key={tipo} className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {ROTULO_TIPO[tipo] ?? tipo} · {itens.length}
                    </p>
                    <Grade materiais={itens} onAbrir={abrir} />
                  </section>
                ))
              ) : pastaAtual && filhas.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Pasta vazia.</p>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Grade({
  materiais, onAbrir, ondeEsta,
}: { materiais: Material[]; onAbrir: (m: Material) => void; ondeEsta?: (m: Material) => string }) {
  if (materiais.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum material encontrado.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {materiais.map((m) => {
        const Icone = iconeDoTipo(m.kind);
        const onde = ondeEsta?.(m);
        return (
          <li key={m.id}>
            <button type="button" onClick={() => onAbrir(m)}
              className="block h-full w-full rounded-xl bg-card p-4 text-left ring-1 ring-black/5 hover:bg-muted/50 dark:ring-white/10">
              {m.capa_url && <img src={m.capa_url} alt="" className="-mt-1 mb-3 h-28 w-full rounded-lg object-cover" />}
              <Icone className="size-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium leading-snug">{m.titulo}</p>
              {m.descricao && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.descricao}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {m.categoria && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{m.categoria}</span>
                )}
                {onde && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{onde}</span>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
