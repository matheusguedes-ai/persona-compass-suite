import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "@/components/team-page";

export const Route = createFileRoute("/_app/mentores")({
  head: () => ({
    meta: [
      { title: "Mentores — Métrica Humana" },
      { name: "description", content: "Convide mentores e defina a quais grupos cada um tem acesso." },
      { property: "og:title", content: "Mentores — Métrica Humana" },
      { property: "og:description", content: "Gestão de mentores e do acesso deles por grupo." },
    ],
  }),
  component: () => <TeamPage kind="mentor" />,
});
