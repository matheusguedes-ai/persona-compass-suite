/**
 * #310 — conversa longa: as duas assistentes mandam ao modelo só as últimas N mensagens. Sem aviso, o
 * começo some em silêncio e ela responde como se lembrasse de tudo. Este bloco vai junto quando houve
 * corte, para ela dizer "essa parte da conversa não chegou até mim" em vez de inventar.
 */
export function avisoDeHistoricoCortado(max: number): string {
  return [
    "<sobre_esta_conversa>",
    `Esta conversa é longa: você está recebendo só as últimas ${max} mensagens dela. As anteriores NÃO chegaram até você.`,
    "Se a pessoa se referir a algo dito antes disso, diga que essa parte da conversa não chegou até você e peça que ela repita o que importa.",
    "</sobre_esta_conversa>",
  ].join("\n");
}
