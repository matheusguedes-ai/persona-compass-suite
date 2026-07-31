import { createFileRoute } from "@tanstack/react-router";
import { MentoriasPage } from "@/components/mentorias-page";

export const Route = createFileRoute("/_app/mentorias/")({
  head: () => ({
    meta: [
      { title: "Mentorias — Métrica Humana" },
      {
        name: "description",
        content: "Pacotes de sessões com cada aluno — agende, conclua e escreva o resumo.",
      },
      { property: "og:title", content: "Mentorias — Métrica Humana" },
      { property: "og:description", content: "Pacotes de mentoria, sessões agendadas e concluídas." },
    ],
  }),
  component: MentoriasPage,
});
