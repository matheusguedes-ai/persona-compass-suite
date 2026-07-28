import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "@/components/team-page";

export const Route = createFileRoute("/_app/colaboradores")({
  head: () => ({
    meta: [
      { title: "Colaboradores — Métrica Humana" },
      { name: "description", content: "Convide sua equipe e defina o que cada pessoa pode fazer na plataforma." },
      { property: "og:title", content: "Colaboradores — Métrica Humana" },
      { property: "og:description", content: "Gestão de colaboradores e permissões." },
    ],
  }),
  component: () => <TeamPage kind="colaborador" />,
});
