/**
 * Caminho antigo, mantido de propósito.
 *
 * A tela virou `/criar-senha` (fora de `/aluno`, para servir aluno e mentor
 * promovido igual — ver esse arquivo). Isto aqui NÃO é a tela: é o mesmo
 * componente, só registrado também neste path velho, para quem já tinha um
 * link de acesso na caixa de entrada quando a mudança saiu (o link aponta pro
 * path que existia na hora do envio). Sem tráfego novo apontando pra cá, dá
 * pra apagar este arquivo depois que o Matheus confirmar que não sobrou link
 * antigo circulando (magic link/invite do Supabase expira sozinho).
 */
import { createFileRoute } from "@tanstack/react-router";
import { CriarSenha } from "./criar-senha";

export const Route = createFileRoute("/aluno/criar-senha")({
  head: () => ({ meta: [{ title: "Criar senha" }, { name: "robots", content: "noindex" }] }),
  component: CriarSenha,
});
