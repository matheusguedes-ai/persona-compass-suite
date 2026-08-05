import { createFileRoute } from "@tanstack/react-router";
import { SessaoPage } from "@/components/sessao-page";

export const Route = createFileRoute("/sessao/$id")({
  head: () => ({ meta: [{ title: "Sua sessão" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { id } = Route.useParams();
    return <SessaoPage id={id} />;
  },
});
