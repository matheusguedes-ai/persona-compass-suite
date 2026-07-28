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
 * Este hook cobre o segundo caso. Sem sessão, devolve `null` e a tela usa a
 * regra do avaliado.
 *
 * Vale dizer: o link do relatório é público por natureza (o avaliado precisa
 * abrir sem conta), então isto é uma trava de interface, não um cofre — quem
 * tiver o link direto consegue imprimir pelo navegador.
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
        // Falha na checagem não deve esconder o botão de quem tem direito.
        if (vivo) setPermitido(null);
      }
    })();
    return () => { vivo = false; };
  }, [responseId]);

  return permitido;
}
