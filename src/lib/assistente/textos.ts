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
    "Oi. Eu sou a assistente do Método Intenção. Posso te ajudar a entender os seus relatórios e a se achar na plataforma — as suas aulas, a agenda, os materiais e as mentorias. Por onde você quer começar?",
  sugestoes: [
    "O que o meu resultado quer dizer?",
    "Quais aulas podem me ajudar com os meus pontos de atenção?",
    "Quando é a minha próxima aula?",
  ],
  rodape: "A assistente pode errar e não substitui o seu mentor. Só você vê esta conversa.",
  placeholder: "Pergunte sobre o seu relatório, as suas aulas, a agenda…",
  pensando: "Olhando o seu relatório e a plataforma…",
  novaConversa: "Nova conversa",
  semConversas: "Nenhuma conversa ainda.",
  indisponivel:
    "A assistente ainda não está disponível para você. Ela aparece quando o seu mentor liberar e você tiver pelo menos um relatório concluído.",
  previa:
    "A assistente é um espaço privado do aluno. Na prévia, as conversas não aparecem — nem para o mentor, nem para ninguém da equipe.",
  meusDados: "Privacidade",
  revogadoAviso: "Autorização retirada. O seu histórico foi apagado e as chaves desligaram.",
} as const;

/**
 * #316A — a tela das chaves de privacidade, do "apagar ou manter em espera" e do termo novo. Os títulos e
 * as descrições de cada chave moram em `chaves.ts` (são os mesmos do termo).
 */
export const PRIVACIDADE = {
  tituloChaves: "Suas chaves",
  introChaves:
    "Cada chave é independente e começa desligada. Você liga o que quiser, quando quiser — e desliga do mesmo jeito.",
  grupoFica: "Ficam só entre você e a assistente",
  grupoSai: "Saem de você",
  grupoSaiNota: "Estas levam algo seu para fora da conversa: para o seu mentor ou para melhorar a assistente.",
  emBreve: "em breve",
  emBreveNota:
    "As chaves marcadas com “em breve” valem para funções que ainda estão chegando à plataforma: a sua escolha fica registrada e passa a valer quando cada uma chegar.",
  precisaDaMemoria: "Só liga com “Lembrar das nossas conversas” ligada.",
  // O diálogo de desligar: a pergunta é a do dono do produto, palavra por palavra.
  desligarTitulo: (titulo: string) => `Desligar “${titulo}”?`,
  desligarJunto: "“Meu mentor acompanha meu progresso” depende desta chave e desliga junto.",
  desligarPergunta: "Quer apagar o que foi guardado, ou manter em espera caso volte a ligar?",
  desligarNadaGuardado: "Como esta função ainda está chegando à plataforma, nada foi guardado por ela até agora.",
  apagarGuardado: "Apagar o que foi guardado",
  manterEmEspera: "Manter em espera",
  continuarLigada: "Deixar ligada",
  desligouApagando: "Chave desligada. O que ela guardou foi apagado.",
  desligouMantendo: "Chave desligada. O que ela guardou fica em espera.",
  ligou: "Chave ligada.",
  // O termo novo para quem aceitou uma versão anterior.
  termoMudouTitulo: "O termo da assistente mudou",
  termoMudouTexto: (versao: number, comChaves: boolean) =>
    `Leia a versão ${versao}${comChaves ? " e escolha as suas chaves" : ""} para continuar. As suas conversas continuam guardadas.`,
  introReaceite: "Leia o termo inteiro. A escolha é sua, e você pode mudar de ideia quando quiser.",
  termoMudouAlternativa: "Prefere não aceitar agora? Você pode baixar uma cópia, apagar tudo ou retirar a autorização.",
  // O painel "Privacidade".
  tituloPainel: "Privacidade e dados",
  oQueFicaGuardado:
    "Fica guardado: a data, a versão e o texto do termo que você aceitou, as chaves que você ligou e cada mudança nelas, e as suas conversas — só você vê. O seu mentor não lê nenhuma delas.",
  numerosDeUso:
    "Para medir o custo da plataforma, cada resposta também registra números de uso (o tamanho da pergunta e da resposta), sem nenhum texto seu.",
  baixar: "Baixar uma cópia de tudo",
  apagarTudo: "Apagar tudo o que a assistente guardou",
  apagarTudoTitulo: "Apagar tudo o que você informou à assistente?",
  apagarTudoTexto:
    "As suas conversas e o que as chaves guardaram — inclusive o que estava em espera — somem e não voltam. A sua autorização e as suas chaves continuam como estão, e fica registrado que você apagou.",
  apagarTudoFeito: "Pronto: tudo o que a assistente guardou foi apagado.",
  revogar: "Retirar a autorização",
  revogarTexto:
    "A assistente para de acessar os seus dados, as quatro chaves desligam e tudo o que ela guardou é apagado — isso não volta. Se quiser usar de novo depois, é só ler e aceitar o termo outra vez.",
} as const;

/** O que o servidor devolve quando a pergunta não pôde ser respondida — nunca o erro técnico cru. */
export const ERROS_DA_ASSISTENTE = {
  semConsentimento: "Para conversar, é preciso aceitar o termo primeiro.",
  termoNovo: "O termo da assistente mudou. Recarregue a página, leia a versão nova e aceite para continuar.",
  naoLiberada: "A assistente não está liberada para você no momento.",
  desligada: "A assistente ainda não está ligada. Tente mais tarde.",
  semRelatorio: "Não encontrei um relatório concluído para conversarmos.",
  falhou: "A assistente não conseguiu responder agora. Tente de novo em instantes.",
  recusa: "Não consigo seguir por esse caminho. Posso te ajudar com o seu relatório, as suas aulas, a agenda ou os materiais.",
  conversaNaoEncontrada: "Conversa não encontrada.",
} as const;
