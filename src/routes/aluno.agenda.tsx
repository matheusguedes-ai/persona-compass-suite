/**
 * A agenda no painel do aluno e do mentor.
 *
 * Para o aluno, só o que é dele. Para o mentor, os grupos que ele acompanha —
 * a RLS já faz esse recorte, e `somenteMinhas` é ligado só para quem não é
 * mentor.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/team.functions";
import { Agenda } from "@/components/agenda";

function Pagina() {
  const fn = useServerFn(getMyMembership);
  const { data, isLoading } = useQuery({ queryKey: ["my-membership"], queryFn: () => fn() });
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const ehMentor = data?.kind === "mentor";
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ehMentor
            ? "As devolutivas dos seus grupos e os eventos que você recebe."
            : "Suas devolutivas e os eventos dos seus grupos."}
        </p>
      </div>
      <Agenda area="aluno" somenteMinhas={!ehMentor} />
    </div>
  );
}

export const Route = createFileRoute("/aluno/agenda")({
  head: () => ({ meta: [{ title: "Agenda" }, { name: "robots", content: "noindex" }] }),
  component: Pagina,
});
