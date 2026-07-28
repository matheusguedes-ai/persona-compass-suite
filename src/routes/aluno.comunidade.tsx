/**
 * Comunidade no painel do avaliado.
 *
 * Quem está em mais de um grupo vê os grupos JUNTOS, num feed só, e o que
 * publica vai para todos eles — decisão do Matheus. Quem está em um grupo vê
 * só o dele, inclusive os posts de quem está em vários, porque esses posts
 * também pertencem ao grupo dele.
 *
 * O avaliado não escolhe destino: escolher grupo a grupo seria uma decisão a
 * mais, toda vez, para resolver um problema que quase ninguém tem.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { meusGrupos } from "@/lib/comunidade.functions";
import { Comunidade } from "@/components/comunidade";
import { Users } from "lucide-react";

function Pagina() {
  const fn = useServerFn(meusGrupos);
  const { data, isLoading } = useQuery({ queryKey: ["meus-grupos"], queryFn: () => fn() });
  const grupos = data?.grupos ?? [];

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (grupos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
        <Users className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-base font-medium">Você ainda não faz parte de nenhuma comunidade</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          As comunidades acontecem dentro dos grupos. Peça ao seu mentor para te adicionar a um —
          assim que ele fizer isso, o espaço aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comunidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {grupos.length === 1
            ? `O espaço de ${grupos[0].name}. Só quem está neste grupo vê o que você publica.`
            : `Você participa de ${grupos.length} grupos, e vê todos aqui. O que você publica aparece em todos eles.`}
        </p>
      </div>
      <Comunidade grupos={grupos} />
    </div>
  );
}

export const Route = createFileRoute("/aluno/comunidade")({
  head: () => ({ meta: [{ title: "Comunidade" }, { name: "robots", content: "noindex" }] }),
  component: Pagina,
});
