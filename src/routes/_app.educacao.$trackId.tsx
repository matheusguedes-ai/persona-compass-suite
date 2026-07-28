import { createFileRoute } from "@tanstack/react-router";
import { TrackView } from "@/components/track-view";

export const Route = createFileRoute("/_app/educacao/$trackId")({
  head: () => ({ meta: [{ title: "Trilha — Métrica Humana" }] }),
  component: () => {
    const { trackId } = Route.useParams();
    return <TrackView trackId={trackId} base="/educacao" />;
  },
});
