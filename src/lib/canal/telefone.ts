/**
 * Telefone para envio de WhatsApp (#291 F1a). Funções puras: sem rede, sem banco.
 *
 * O número guardado no cadastro NUNCA é alterado — a padronização acontece só na hora do envio.
 * Regra: tirar tudo que não é dígito e exigir DDD + 9 + número (11 dígitos), acrescentando o 55
 * do Brasil. Quem já digitou o 55 (13 dígitos começando por 55) é aceito como está. Um número de
 * 10 dígitos (fixo, ou celular antigo sem o 9) NÃO é adivinhado: vira "telefone inválido".
 */

export type TelefoneNormalizado =
  | { ok: true; internacional: string; mascarado: string }
  | { ok: false; motivo: string; mascarado: string };

export const MOTIVO_TELEFONE_INVALIDO = "telefone inválido";

/** Só os dígitos, ou "" se não houver texto. */
function digitos(bruto: string | null | undefined): string {
  return (bruto ?? "").replace(/\D/g, "");
}

/** "(18) 9****-**21" para número de 11 dígitos; para qualquer outro, só o fim ("***21"). Nunca o número inteiro. */
export function mascararTelefone(bruto: string | null | undefined): string {
  const d = digitos(bruto);
  if (d.length === 0) return "";
  const nacional = d.length === 13 && d.startsWith("55") ? d.slice(2) : d;
  if (nacional.length === 11) return `(${nacional.slice(0, 2)}) ${nacional[2]}****-**${nacional.slice(-2)}`;
  return d.length >= 4 ? `***${d.slice(-2)}` : "***";
}

export function normalizarTelefoneBR(bruto: string | null | undefined): TelefoneNormalizado {
  const d = digitos(bruto);
  const mascarado = mascararTelefone(bruto);
  const nacional = d.length === 13 && d.startsWith("55") ? d.slice(2) : d;
  // DDD de 11 a 99 (não existe DDD começando por 0 ou 10) e o 9 do celular logo depois.
  const valido = /^[1-9][1-9]9\d{8}$/.test(nacional);
  if (!valido) return { ok: false, motivo: MOTIVO_TELEFONE_INVALIDO, mascarado };
  return { ok: true, internacional: `55${nacional}`, mascarado };
}

/**
 * Chave para COMPARAR telefones escritos de jeitos diferentes (#M1a): DDD + os 8 últimos dígitos. Ignora o 55, o 9 do
 * celular (número antigo de 8 dígitos casa com o novo de 9), símbolos e espaços. Só serve para achar o cadastro de quem
 * mandou uma mensagem — nunca para enviar (o envio exige DDD + 9 + número, ver `normalizarTelefoneBR`).
 */
export function chaveDoTelefone(bruto: string | null | undefined): string | null {
  let d = (bruto ?? "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return `${d.slice(0, 2)}${d.slice(-8)}`;
}
