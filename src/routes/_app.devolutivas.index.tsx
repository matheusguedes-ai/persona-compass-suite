import { createFileRoute } from "@tanstack/react-router";
import { DevolutivasPage } from "@/components/devolutivas-page";

export const Route = createFileRoute("/_app/devolutivas/")({
  head: () => ({
    meta: [
      { title: "Devolutivas — Métrica Humana" },
      {
        name: "description",
        content: "Acompanhe quem já recebeu a devolutiva do resultado e o que ficou combinado em cada conversa.",
      },
      { property: "og:title", content: "Devolutivas — Métrica Humana" },
      { property: "og:description", content: "Fila de devolutivas e registro das conversas com os avaliados." },
    ],
  }),
  component: DevolutivasPage,
});
