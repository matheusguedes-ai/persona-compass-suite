import { createFileRoute } from "@tanstack/react-router";
import { MentoriaDetalhe } from "@/components/mentoria-detalhe";

export const Route = createFileRoute("/_app/mentorias/$id")({
  head: () => ({
    meta: [{ title: "Mentoria — Métrica Humana" }],
  }),
  component: () => {
    const { id } = Route.useParams();
    return <MentoriaDetalhe id={id} />;
  },
});
