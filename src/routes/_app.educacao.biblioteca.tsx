/**
 * `/educacao/biblioteca` — #313: a Biblioteca saiu da Academy e virou menu próprio (`/biblioteca`).
 *
 * Ela nunca teve endereço só dela: era uma seção da página da Academy. Este redirect existe para quem
 * procurar pelo caminho "de dentro da Academy" cair no lugar novo em vez de numa trilha inexistente
 * (sem ele, `/educacao/biblioteca` seria lido como `/educacao/$trackId`).
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/educacao/biblioteca")({
  beforeLoad: () => {
    throw redirect({ to: "/biblioteca" });
  },
});
