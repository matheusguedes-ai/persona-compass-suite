import { createFileRoute } from "@tanstack/react-router";
import { TrackView } from "@/components/track-view";

export const Route = createFileRoute("/aluno/educacao/$trackId")({
  validateSearch: (s: Record<string, unknown>) => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
  }),
  head: () => ({ meta: [{ title: "Trilha" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { trackId } = Route.useParams();
    const { ver } = Route.useSearch();
    return <TrackView trackId={trackId} base="/aluno/educacao" previewPersonId={ver ?? null} />;
  },
});
