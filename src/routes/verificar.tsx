/**
 * #221 F3 — layout de `/verificar/*`. Só existe para o roteamento por
 * arquivo não quebrar: com `verificar.index.tsx` (o formulário) e
 * `verificar.$codigo.tsx` (o resultado) como filhos, este arquivo É o pai
 * automático — sem conteúdo próprio, só repassa para o filho certo. Ver o
 * comentário grande em verificar.index.tsx.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/verificar")({
  component: () => <Outlet />,
});
