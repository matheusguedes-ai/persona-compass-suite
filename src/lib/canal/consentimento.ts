/**
 * Consentimento para receber mensagens por WhatsApp (#291 F1b). Funções e textos PUROS: sem rede, sem banco.
 *
 * A regra é deste arquivo; quem a aplica é `consentimento.server.ts`. A F1c pergunta a `podeEnviarWhatsapp`
 * ANTES de mandar qualquer aviso a um aluno — o consentimento vigente e o nível decidem.
 */

export type NivelWhatsapp = "essencial" | "completo";
export const NIVEIS_WHATSAPP: readonly NivelWhatsapp[] = ["essencial", "completo"];

export const TERMO_VERSAO = "whatsapp-v1";

/** O texto do termo, EXATAMENTE como aprovado — mostrado antes do botão de confirmar e copiado no registro do aceite. */
export const TERMO_TEXTO =
  "Ao ativar, você autoriza a Plataforma Método Intenção a enviar mensagens para o seu WhatsApp sobre a sua jornada " +
  "no programa, conforme o nível que você escolheu. As mensagens saem de um número da plataforma, por meio de um " +
  "serviço parceiro de envio (Zapster), que recebe apenas o seu número e o texto de cada mensagem. Não usamos o seu " +
  "número para propaganda nem o repassamos a mais ninguém. Você pode mudar o nível ou desligar quando quiser, nesta " +
  "mesma tela. Seus dados seguem a Lei Geral de Proteção de Dados (LGPD).";

export const ROTULO_NIVEL: Record<NivelWhatsapp, { titulo: string; descricao: string }> = {
  essencial: {
    titulo: "Essencial",
    descricao: "Só o que mexe na sua agenda: lembretes de mentoria e de aula, mudanças, cancelamentos e remarcações.",
  },
  completo: {
    titulo: "Completo",
    descricao: "O essencial, mais a comunidade, os testes liberados para você e os conteúdos novos.",
  },
};

// ---- o código de confirmação ----
export const TIPO_CODIGO = "codigo_confirmacao";
export const CODIGO_VALIDADE_MINUTOS = 10;
export const CODIGO_MAX_POR_HORA = 3;
export const CODIGO_MAX_TENTATIVAS = 5;

export function textoDoCodigo(codigo: string): string {
  return (
    `Seu código de confirmação da Plataforma Método Intenção é: ${codigo}. ` +
    `Ele vale por ${CODIGO_VALIDADE_MINUTOS} minutos. Se não foi você que pediu, ignore esta mensagem.`
  );
}

export function codigoBemFormado(codigo: string): boolean {
  return /^\d{6}$/.test(codigo);
}

// ---- o que cada nível cobre ----
/** Avisos que mexem na agenda do aluno. */
const TIPOS_ESSENCIAIS = [
  "lembrete_mentoria",
  "lembrete_aula",
  "mentoria_agendada",
  "sessao_cancelada",
  "sessao_remarcada",
  "aula_cancelada",
  "aula_remarcada",
  "mentor_resposta_aluno", // M1b: aviso ao mentor/dono de que um aluno respondeu no WhatsApp
] as const;

/** Além do essencial: comunidade, testes liberados e conteúdo novo. */
const TIPOS_SO_NO_COMPLETO = [
  "comunidade_post",
  "comunidade_comentario",
  "comunidade_mencao",
  "teste_liberado",
  "conteudo_novo",
  "evento_novo",
] as const;

/**
 * O nível MÍNIMO que cobre um tipo de aviso, ou null se o tipo não é conhecido (negado por padrão: aviso novo
 * só sai depois de alguém decidir em qual nível ele entra). O código de confirmação NÃO passa por aqui: é
 * pedido pelo próprio aluno e tem caminho próprio.
 */
export function nivelMinimoDoTipo(tipo: string): NivelWhatsapp | null {
  if ((TIPOS_ESSENCIAIS as readonly string[]).includes(tipo)) return "essencial";
  if ((TIPOS_SO_NO_COMPLETO as readonly string[]).includes(tipo)) return "completo";
  return null;
}

export function nivelCobre(nivel: NivelWhatsapp, tipo: string): boolean {
  const minimo = nivelMinimoDoTipo(tipo);
  if (minimo === null) return false;
  return minimo === "essencial" || nivel === "completo";
}
