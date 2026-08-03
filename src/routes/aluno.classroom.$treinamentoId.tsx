import { createFileRoute } from "@tanstack/react-router";
import { TreinamentoView } from "@/components/classroom-view";

export const Route = createFileRoute("/aluno/classroom/$treinamentoId")({
  validateSearch: (s: Record<string, unknown>) => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
  }),
  head: () => ({ meta: [{ title: "Treinamento" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { treinamentoId } = Route.useParams();
    const { ver } = Route.useSearch();
    return (
      <TreinamentoView
        treinamentoId={treinamentoId}
        base="/aluno/classroom"
        previewPersonId={ver ?? null}
      />
    );
  },
});
