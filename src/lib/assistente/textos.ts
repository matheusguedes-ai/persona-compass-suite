/**
 * Textos FIXOS da tela da assistente (#289). Não é conteúdo de perfil — é a moldura da conversa, e
 * segue a mesma voz das orientações: frase curta, sem elogio, sem prometer o que ela não faz.
 * O termo de consentimento NÃO mora aqui: é do dono do produto, versionado em `assistente_termos`.
 */
export const ASSISTENTE = {
  nome: "Assistente",
  tituloTermo: "Termo de consentimento — Assistente do Método Intenção",
  introTermo: "Antes do primeiro uso, leia o termo inteiro. A escolha é sua, e você pode mudar de ideia quando quiser.",
  aceitar: "Aceitar e começar",
  agoraNao: "Agora não",
  abertura:
    "Oi. Eu sou a assistente do Método Intenção. Posso te ajudar a entender o que está escrito nos seus relatórios — o seu perfil, os números e o que eles querem dizer no dia a dia. Por onde você quer começar?",
  sugestoes: [
    "O que o meu resultado quer dizer?",
    "Quais são os meus pontos fortes, segundo o relatório?",
    "O que o relatório diz para eu tomar cuidado?",
  ],
  rodape: "A assistente pode errar e não substitui o seu mentor. Só você vê esta conversa.",
  placeholder: "Pergunte sobre o seu relatório…",
  pensando: "Lendo o seu relatório…",
  novaConversa: "Nova conversa",
  semConversas: "Nenhuma conversa ainda.",
  indisponivel:
    "A assistente ainda não está disponível para você. Ela aparece quando o seu mentor liberar e você tiver pelo menos um relatório concluído.",
  previa:
    "A assistente é um espaço privado do aluno. Na prévia, as conversas não aparecem — nem para o mentor, nem para ninguém da equipe.",
  meusDados: "O que fica guardado",
  revogadoAviso: "Autorização retirada. O seu histórico foi apagado.",
} as const;

/** O que o servidor devolve quando a pergunta não pôde ser respondida — nunca o erro técnico cru. */
export const ERROS_DA_ASSISTENTE = {
  semConsentimento: "Para conversar, é preciso aceitar o termo primeiro.",
  naoLiberada: "A assistente não está liberada para você no momento.",
  desligada: "A assistente ainda não está ligada. Tente mais tarde.",
  semRelatorio: "Não encontrei um relatório concluído para conversarmos.",
  falhou: "A assistente não conseguiu responder agora. Tente de novo em instantes.",
  recusa: "Não consigo seguir por esse caminho. Posso te ajudar com o que está no seu relatório.",
  conversaNaoEncontrada: "Conversa não encontrada.",
} as const;
