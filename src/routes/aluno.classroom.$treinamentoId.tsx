import { createFileRoute } from "@tanstack/react-router";
import { TreinamentoView } from "@/components/classroom-view";

export const Route = createFileRoute("/aluno/classroom/$treinamentoId")({
  head: () => ({ meta: [{ title: "Treinamento" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { treinamentoId } = Route.useParams();
    return <TreinamentoView treinamentoId={treinamentoId} base="/aluno/classroom" />;
  },
});
