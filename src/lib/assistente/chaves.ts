/**
 * #316, fatia A — as quatro CHAVES de privacidade da assistente, aprovadas pelo dono do produto em
 * 28/09/2026. Serve à tela e ao servidor; a REGRA mora no banco (`assistente_gravar_chaves`, migração
 * 20260930120000): tudo começa desligado, a 3 só liga com a 1 e desliga junto com ela, e desligar
 * exige escolher entre apagar o que a chave guardou ou manter em espera. Aqui só se repete a regra
 * para a tela não oferecer o que o banco vai recusar.
 *
 * São INDEPENDENTES, não uma escala: escala obrigaria o aluno a aceitar o que não quer para chegar no
 * que quer. As duas primeiras ficam só entre ele e a assistente; as duas últimas levam algo dele para
 * fora — e a tela mostra essa separação, nunca as quatro iguais.
 *
 * Os títulos são os mesmos do termo (versão 2, `scripts/conteudo_termo_assistente.py`): mudou um, muda
 * o outro — o `conferir` do script do termo confere que os quatro títulos daqui estão no texto.
 */
export const CHAVES = ["lembrar_conversas", "aprender_plataforma", "mentor_acompanha", "melhorar_assistente"] as const;
export type Chave = (typeof CHAVES)[number];
export type EstadoDasChaves = Record<Chave, boolean>;
export type EscolhaAoDesligar = "apagar" | "manter";
export type EscolhasAoDesligar = Partial<Record<Chave, EscolhaAoDesligar>>;

export const TODAS_DESLIGADAS: EstadoDasChaves = {
  lembrar_conversas: false,
  aprender_plataforma: false,
  mentor_acompanha: false,
  melhorar_assistente: false,
};

type DefinicaoDaChave = {
  titulo: string;
  /** O que liga, e quem passa a ver — em uma frase. */
  descricao: string;
  /** "fica": só entre o aluno e a assistente. "sai": leva algo dele para fora da conversa. */
  grupo: "fica" | "sai";
  /**
   * A função que a chave liga já existe na plataforma? Enquanto não existir, a tela marca "em breve"
   * (a escolha fica registrada e passa a valer quando ela chegar). Quem construir a função muda aqui.
   */
  disponivel: boolean;
};

export const DEFINICAO_DAS_CHAVES: Record<Chave, DefinicaoDaChave> = {
  lembrar_conversas: {
    titulo: "Lembrar das nossas conversas",
    descricao: "Ela guarda o que foi dito de uma conversa para a outra. Desligada, cada conversa começa do zero. Só você e ela.",
    grupo: "fica",
    disponivel: false, // fatia B
  },
  aprender_plataforma: {
    titulo: "Aprender com o que eu faço na plataforma",
    descricao:
      "Ela usa o que você assistiu, o que deixou pela metade, o seu ritmo e os seus pontos para ajustar as respostas a você. Só você e ela.",
    grupo: "fica",
    disponivel: false,
  },
  mentor_acompanha: {
    titulo: "Meu mentor acompanha meu progresso",
    descricao:
      "O seu mentor recebe o tema, o padrão e o progresso das conversas — nunca a conversa escrita, nem o que você contou em confiança.",
    grupo: "sai",
    disponivel: false, // fatia D
  },
  melhorar_assistente: {
    titulo: "Ajudar a melhorar a assistente",
    descricao: "As suas conversas ajudam a calibrar a assistente da plataforma, sem o seu nome nem nada que identifique você.",
    grupo: "sai",
    disponivel: false,
  },
};

/** Lê o estado que veio do banco (jsonb) sem confiar no formato: o que faltar vale "desligada". */
export function lerChaves(bruto: unknown): EstadoDasChaves {
  const o = bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : {};
  return Object.fromEntries(CHAVES.map((c) => [c, o[c] === true])) as EstadoDasChaves;
}

/**
 * O estado depois de o aluno mexer numa chave, já com a dependência: desligar a 1 desliga a 3 junto;
 * ligar a 3 com a 1 desligada não muda nada (a tela nem oferece — o banco recusaria).
 */
export function mexerNaChave(estado: EstadoDasChaves, chave: Chave, ligada: boolean): EstadoDasChaves {
  if (chave === "mentor_acompanha" && ligada && !estado.lembrar_conversas) return estado;
  const novo = { ...estado, [chave]: ligada };
  if (chave === "lembrar_conversas" && !ligada) novo.mentor_acompanha = false;
  return novo;
}

/** As chaves que estavam ligadas em `antes` e ficam desligadas em `depois` — as que pedem a escolha. */
export function desligadasEntre(antes: EstadoDasChaves, depois: EstadoDasChaves): Chave[] {
  return CHAVES.filter((c) => antes[c] && !depois[c]);
}
