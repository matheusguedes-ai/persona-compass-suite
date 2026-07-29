/**
 * O mesmo quadro, no painel do mentor.
 *
 * O mentor vive em /aluno. Apontar o menu dele para `/gestao` — rota `_app` —
 * o jogaria no layout do dono, com a barra lateral do dono. Já aconteceu uma
 * vez com o menu Grupos; a rota própria é a correção.
 *
 * O componente é o mesmo: a RLS já entrega só a gente dos grupos dele.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/team.functions";
import { QuadroGestao } from "@/components/quadro-gestao";
import { LayoutList } from "lucide-react";

function Pagina() {
  const fn = useServerFn(getMyMembership);
  const { data, isLoading } = useQuery({ queryKey: ["my-membership"], queryFn: () => fn() });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  // O aluno não vê este quadro: ele mostra a situação dos colegas. Decisão do
  // Matheus em 29/07 — master e mentores, mais ninguém.
  if (data?.kind !== "mentor") {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center">
        <LayoutList className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-base font-medium">Esta área é de quem coordena</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seus próprios resultados e devolutivas estão nos outros menus.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Gestão</h1>
      <QuadroGestao />
    </div>
  );
}

export const Route = createFileRoute("/aluno/gestao")({
  head: () => ({ meta: [{ title: "Gestão" }, { name: "robots", content: "noindex" }] }),
  component: Pagina,
});
