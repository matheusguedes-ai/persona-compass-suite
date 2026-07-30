import { BannersAcademy } from "@/components/banners-academy";
import { Biblioteca } from "@/components/biblioteca";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTracks } from "@/lib/learning.functions";
import { Prateleira, CatalogoVazio, type TrackCard } from "@/components/learning-catalog";

export const Route = createFileRoute("/aluno/educacao/")({
  // `ver` = prévia do painel do aluno. Precisa chegar até aqui: sem ele, o
  // professor pré-visualizando veria tudo destrancado (ele abre tudo) e o
  // cadeado não teria como ser conferido.
  validateSearch: (s: Record<string, unknown>) => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
  }),
  head: () => ({ meta: [{ title: "Academy" }, { name: "robots", content: "noindex" }] }),
  component: EducacaoAluno,
});

function EducacaoAluno() {
  const { ver } = Route.useSearch();
  const fn = useServerFn(listTracks);
  const { data: trilhas = [], isLoading } = useQuery({
    queryKey: ["tracks", ver ?? null],
    queryFn: () => fn({ data: { preview_person_id: ver ?? null } }),
  });
  const lista = (trilhas as TrackCard[]).filter((t) => t.is_published);
  const abertas = lista.filter((t) => t.liberada !== false);
  const trancadas = lista.filter((t) => t.liberada === false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Academy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trilhas liberadas para você. Seu progresso fica salvo aula a aula.
        </p>
      </div>

      <BannersAcademy />

      <Biblioteca />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : lista.length === 0 ? (
        <CatalogoVazio podeEditar={false} />
      ) : (
        <div className="space-y-8">
          <Prateleira
            titulo="Disponíveis para você" trilhas={abertas}
            base="/aluno/educacao" search={{ ver }}
          />
          {/* Trancadas aparecem de propósito: saber que existe é o que faz o
              aluno pedir acesso. Escondê-las deixaria o catálogo menor sem
              motivo aparente. */}
          <Prateleira
            titulo="Ainda não liberadas"
            ajuda="Estas trilhas existem, mas o acesso ainda não foi liberado para você."
            trilhas={trancadas} base="/aluno/educacao" search={{ ver }}
          />
        </div>
      )}
    </div>
  );
}
