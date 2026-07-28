/**
 * Comunidades, no painel do dono.
 *
 * Todas as comunidades num lugar só, em vez de entrar grupo por grupo para ver
 * o que aconteceu. Ao publicar, ele escolhe para quais grupos vai — o mesmo
 * texto pode servir a três turmas sem virar três publicações.
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Comunidades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que está acontecendo em todos os seus grupos. Ao publicar, escolha para quais deles vai.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && grupos.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-base font-medium">Nenhum grupo ainda</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A comunidade acontece dentro dos grupos. Crie um em Grupos para começar.
          </p>
        </div>
      )}

      {grupos.length > 0 && <Comunidade grupos={grupos} escolherDestino />}
    </div>
  );
}

export const Route = createFileRoute("/_app/comunidades")({
  head: () => ({
    meta: [
      { title: "Comunidades — Métrica Humana" },
      { name: "description", content: "As publicações de todos os seus grupos num lugar só." },
    ],
  }),
  component: Pagina,
});
