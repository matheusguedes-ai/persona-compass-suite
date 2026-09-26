/**
 * Textos FIXOS da tela da assistente do MENTOR (#307). A moldura da conversa, na mesma voz das
 * orientações dela (`instrucoes.server.ts`): frase curta, sem prometer o que ela não faz.
 *
 * Separados dos textos da assistente do aluno (`assistente/textos.ts`) de propósito: são duas
 * assistentes, com públicos e limites diferentes, e um ajuste numa não pode mudar a outra.
 */
export const ASSISTENTE_DO_MENTOR = {
  nome: "Assistente",
  titulo: "Assistente do painel",
  subtitulo:
    "Pergunte sobre os seus alunos: resultados dos testes, presença, aulas vistas, ranking, campanhas e quem tem login.",
  abertura:
    "Oi. Eu sou a assistente do Método Intenção no seu painel. Eu leio os resultados dos testes e o uso da plataforma pelos alunos da sua conta — o mesmo que você vê no painel — e digo de onde tirei cada número. As conversas dos alunos com a assistente deles não chegam a mim. Por onde você quer começar?",
  sugestoes: [
    "Como está distribuído o DISC de cada turma?",
    "Quem ainda não concluiu nenhum teste?",
    "Quem está com presença baixa no Classroom?",
    "Quem ainda não tem login na plataforma?",
  ],
  rodape:
    "A assistente pode errar: confira no painel antes de decidir. Ela não lê as conversas dos alunos com a assistente deles. Só você vê esta conversa.",
  placeholder: "Pergunte sobre os seus alunos, uma turma, um teste…",
  pensando: "Lendo os resultados e o uso da plataforma…",
  novaConversa: "Nova conversa",
  semConversas: "Nenhuma conversa ainda.",
  indisponivel:
    "A assistente do painel está disponível para o dono da conta, quando houver alunos cadastrados.",
  apagarTudo: "Apagar todas as conversas",
  apagarTudoConfirma:
    "Todas as suas conversas com a assistente do painel serão apagadas. Isso não pode ser desfeito.",
} as const;

/** O que o servidor devolve quando a pergunta não pôde ser respondida — nunca o erro técnico cru. */
export const ERROS_DA_ASSISTENTE_DO_MENTOR = {
  naoLiberada: "A assistente do painel está disponível só para o dono da conta, com alunos cadastrados.",
  desligada: "A assistente está fora do ar agora. Tente mais tarde.",
  semDados: "Não consegui ler os dados da conta agora. Tente de novo em instantes.",
  falhou: "A assistente não conseguiu responder agora. Tente de novo em instantes.",
  recusa:
    "Não consigo seguir por esse caminho. Posso ajudar com os resultados dos testes e o uso da plataforma pelos seus alunos.",
  conversaNaoEncontrada: "Conversa não encontrada.",
} as const;
