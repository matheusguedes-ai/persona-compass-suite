/**
 * Menu Gestão — o quadro de devolutivas.
 *
 * Etapa 1 do plano (`docs/plano-menu-gestao.md`). A aba Agenda entra na etapa
 * 2; até lá não existe aba nenhuma, de propósito: aba vazia prometendo algo é
 * pior que aba nenhuma.
 */
import { createFileRoute } from "@tanstack/react-router";
import { QuadroGestao } from "@/components/quadro-gestao";

export const Route = createFileRoute("/_app/gestao")({
  head: () => ({ meta: [{ title: "Gestão — Métrica Humana" }] }),
  component: () => (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestão</h1>
      </div>
      <QuadroGestao />
    </div>
  ),
});
