import { Biblioteca } from "@/components/biblioteca";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTracks } from "@/lib/learning.functions";
import { Prateleira, CatalogoVazio, type TrackCard } from "@/components/learning-catalog";

export const Route = createFileRoute("/aluno/educacao/")({
  head: () => ({ meta: [{ title: "Academy" }, { name: "robots", content: "noindex" }] }),
  component: EducacaoAluno,
});

function EducacaoAluno() {
  const fn = useServerFn(listTracks);
  const { data: trilhas = [], isLoading } = useQuery({ queryKey: ["tracks"], queryFn: () => fn() });
  const lista = (trilhas as TrackCard[]).filter((t) => t.is_published);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Academy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trilhas liberadas para você. Seu progresso fica salvo aula a aula.
        </p>
      </div>

      <Biblioteca />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : lista.length === 0 ? (
        <CatalogoVazio podeEditar={false} />
      ) : (
        <Prateleira titulo="Disponíveis para você" trilhas={lista} base="/aluno/educacao" />
      )}
    </div>
  );
}
