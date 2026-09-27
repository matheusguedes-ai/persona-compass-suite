/**
 * `/aluno/educacao/biblioteca` — #313: a Biblioteca do aluno saiu da Academy e virou menu próprio
 * (`/aluno/biblioteca`). Mesmo motivo do redirect do painel: sem ele o endereço cairia na rota da
 * trilha. `ver` (a prévia "ver como aluno") vai junto.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/aluno/educacao/biblioteca")({
  validateSearch: (s: Record<string, unknown>) => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/aluno/biblioteca", search: { ver: search.ver } });
  },
});
