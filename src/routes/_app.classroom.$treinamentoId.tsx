import { createFileRoute } from "@tanstack/react-router";
import { TreinamentoView } from "@/components/classroom-view";

export const Route = createFileRoute("/_app/classroom/$treinamentoId")({
  head: () => ({ meta: [{ title: "Treinamento — Métrica Humana" }] }),
  component: () => {
    const { treinamentoId } = Route.useParams();
    return <TreinamentoView treinamentoId={treinamentoId} base="/classroom" />;
  },
});
