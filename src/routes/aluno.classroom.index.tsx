/**
 * Classroom do aluno: os treinamentos presenciais liberados para os grupos
 * dele. A RLS (`posso_ver_treinamento`) já entrega só o publicado para um
 * grupo do aluno — aqui é vitrine, sem regra de visibilidade nenhuma.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTreinamentos } from "@/lib/classroom.functions";
import {
  PrateleiraTreinamentos, ClassroomVazio, type TreinamentoCard,
} from "@/components/classroom-catalog";

export const Route = createFileRoute("/aluno/classroom/")({
  head: () => ({ meta: [{ title: "Classroom" }, { name: "robots", content: "noindex" }] }),
  component: ClassroomAluno,
});

function ClassroomAluno() {
  const fn = useServerFn(listTreinamentos);
  const { data: treinamentos = [], isLoading } = useQuery({
    queryKey: ["treinamentos"],
    queryFn: () => fn(),
  });
  // Na prévia "Ver como aluno" quem consulta é o dono, e a RLS devolve também
  // os rascunhos dele — o filtro mantém a prévia igual ao que o aluno vê.
  const lista = (treinamentos as TreinamentoCard[]).filter((t) => t.publicado);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Classroom</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os treinamentos presenciais da sua turma: datas, locais e o material de cada encontro.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : lista.length === 0 ? (
        <ClassroomVazio podeEditar={false} />
      ) : (
        <PrateleiraTreinamentos titulo="Disponíveis para você" treinamentos={lista} base="/aluno/classroom" />
      )}
    </div>
  );
}
