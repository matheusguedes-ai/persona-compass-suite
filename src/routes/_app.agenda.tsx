/**
 * Agenda — o menu de tempo.
 *
 * Era uma aba dentro de "Gestão". O Matheus usou e concluiu que não colava:
 * Kanban e agenda respondem a perguntas diferentes — "quem está esperando" e
 * "o que tenho hoje". Juntá-las num menu só obrigava a escolher uma aba antes
 * de ver qualquer coisa.
 *
 * O Kanban foi para Devolutivas, que é o assunto dele. Aqui ficou só o tempo.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Agenda } from "@/components/agenda";

export const Route = createFileRoute("/_app/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Métrica Humana" }] }),
  component: () => (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          As mentorias marcadas e os eventos que você criar.
        </p>
      </div>
      <Agenda podeCriar />
    </div>
  ),
});
