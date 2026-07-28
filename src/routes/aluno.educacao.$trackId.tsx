import { createFileRoute } from "@tanstack/react-router";
import { TrackView } from "@/components/track-view";

export const Route = createFileRoute("/aluno/educacao/$trackId")({
  head: () => ({ meta: [{ title: "Trilha" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { trackId } = Route.useParams();
    return <TrackView trackId={trackId} base="/aluno/educacao" />;
  },
});
