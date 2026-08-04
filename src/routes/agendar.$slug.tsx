import { createFileRoute } from "@tanstack/react-router";
import { AgendarPage } from "@/components/agendar-page";

export const Route = createFileRoute("/agendar/$slug")({
  head: () => ({ meta: [{ title: "Agendar sessão" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { slug } = Route.useParams();
    return <AgendarPage slug={slug} />;
  },
});
