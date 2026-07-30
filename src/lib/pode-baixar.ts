import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canDownloadReport } from "@/lib/team.functions";

/**
 * O botão de baixar PDF tem dois donos de regra:
 * - o **avaliado** abre o relatório sem login → vale o `allow_pdf` das
 *   Configurações do mentor;
 * - um **mentor convidado** abre pela plataforma → vale o "pode baixar" do
 *   grupo pelo qual ele enxerga aquele avaliado.
 *
 * Três estados, e a diferença entre eles importa:
 *   `null`  — ninguém logado. A tela cai na regra do avaliado.
 *   `true`  — logado e autorizado.
 *   `false` — logado e **não** autorizado. Não cai em regra nenhuma.
 *
 * ⚠️ A checagem falha FECHADA. Antes, um erro na consulta devolvia `null`, a
 * tela lia isso como "ninguém logado" e usava a regra do avaliado — que quase
 * sempre é permitir. Bastava a checagem falhar para o mentor sem permissão
 * ganhar o botão.
 *
 * ⚠️ E, dito com todas as letras: isto é uma trava de INTERFACE, não um cofre.
 * O relatório abre por link sem login — é assim que o avaliado o recebe —,
 * então quem tem o link imprime pelo navegador de qualquer jeito. Fechar isso
 * de verdade exigiria pedir login para ver relatório, que é decisão de
 * produto, não de código.
 */
export function usePodeBaixar(responseId: string | null | undefined) {
  const [permitido, setPermitido] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!responseId) { setPermitido(null); return; }
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      if (!data.session) { setPermitido(null); return; }
      try {
        const r = await canDownloadReport({ data: { response_id: responseId } });
        if (vivo) setPermitido(r.allowed);
      } catch {
        // Logado e a checagem falhou: NÃO liberar. Um botão a menos para quem
        // tinha direito é recuperável (recarregar a página); um botão a mais
        // para quem não tinha vira relatório de terceiro impresso.
        if (vivo) setPermitido(false);
      }
    })();
    return () => { vivo = false; };
  }, [responseId]);

  return permitido;
}
