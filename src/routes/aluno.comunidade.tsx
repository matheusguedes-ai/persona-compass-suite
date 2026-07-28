/**
 * Comunidade no painel do avaliado.
 *
 * Um feed por grupo. Quem está em mais de um escolhe qual quer ver — misturar
 * grupos num feed só juntaria gente que não se conhece e quebraria a premissa
 * de que só quem está no grupo vê o que é publicado ali.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { meusGrupos } from "@/lib/comunidade.functions";
import { Comunidade } from "@/components/comunidade";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

function Pagina() {
  const fn = useServerFn(meusGrupos);
  const { data, isLoading } = useQuery({ queryKey: ["meus-grupos"], queryFn: () => fn() });
  const [escolhido, setEscolhido] = useState<string | null>(null);

  const grupos = data?.grupos ?? [];
  const atual = escolhido ?? grupos[0]?.id ?? null;

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (grupos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
        <Users className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-base font-medium">Você ainda não está em nenhum grupo</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          A comunidade acontece dentro dos grupos. Quando seu mentor te incluir em um, o espaço
          dele aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comunidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que você publica aqui é visto só por quem está neste grupo.
        </p>
      </div>

      {grupos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {grupos.map((g) => (
            <button
              key={g.id}
              onClick={() => setEscolhido(g.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition",
                g.id === atual ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {atual && <Comunidade groupId={atual} />}
    </div>
  );
}

export const Route = createFileRoute("/aluno/comunidade")({
  head: () => ({ meta: [{ title: "Comunidade" }, { name: "robots", content: "noindex" }] }),
  component: Pagina,
});
