import { createFileRoute } from "@tanstack/react-router";
import { AgendamentoPage } from "@/components/agendamento-page";

export const Route = createFileRoute("/_app/mentorias/agendamento")({
  head: () => ({
    meta: [
      { title: "Agendamento automático — Métrica Humana" },
      {
        name: "description",
        content: "Defina quando você atende e crie links para o aluno marcar sozinho.",
      },
    ],
  }),
  component: AgendamentoPage,
});
