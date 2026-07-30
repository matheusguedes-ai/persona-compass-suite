/**
 * `/mentores` — a tela antiga, aposentada.
 *
 * Ela convidava mentor por e-mail e criava uma linha em `team_members` SEM
 * `person_id`: um cadastro solto, que não é ninguém em `people`. Essa pessoa
 * ficava sem ficha, fora dos grupos como avaliada, sem histórico de testes e
 * sem painel de aluno — e, se depois fosse cadastrada como pessoa, virava dois
 * registros da mesma gente na mesma conta.
 *
 * O desenho vigente é "mentor é aluno promovido, um cadastro só":
 * `promover_a_mentor(person_id)`, na ficha da própria pessoa, reaproveita a
 * linha de `team_members` quando já existe e a amarra ao `people`.
 *
 * Redirect e não arquivo apagado: o endereço já circulou, e 404 não explica
 * nada a quem tem o link salvo. A tela continuava no ar respondendo pelo
 * endereço direto — era esse o problema, não a falta dela.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/mentores")({
  beforeLoad: () => {
    throw redirect({ to: "/pessoas" });
  },
});
