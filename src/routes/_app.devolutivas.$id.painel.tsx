import { createFileRoute } from "@tanstack/react-router";
import { PainelDevolutiva } from "@/components/painel-devolutiva";

export const Route = createFileRoute("/_app/devolutivas/$id/painel")({
  head: () => ({
    meta: [
      { title: "Painel da devolutiva — Métrica Humana" },
      { name: "description", content: "O resultado completo do avaliado numa tela só, para conduzir a conversa de devolutiva." },
    ],
  }),
  component: function Painel() {
    const { id } = Route.useParams();
    return <PainelDevolutiva id={id} />;
  },
});
