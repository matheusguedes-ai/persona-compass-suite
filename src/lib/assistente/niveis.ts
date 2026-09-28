/**
 * #317 — os três níveis de potência da assistente (a do aluno e a do mentor): Básica, Smart e Pro.
 *
 * Aqui mora só o que a TELA e o SERVIDOR do app precisam: o nome, a explicação de uma linha e a regra de
 * qual nível vale. QUAL MODELO atende cada nível mora num lugar só — a edge function `assistente-chat`
 * (`NIVEIS`) — e o registro de uso guarda o modelo que ELA devolveu. Nunca copiar o mapa para cá.
 *
 * O teto do aluno é a soma das liberações que valem para ele (grupo + individual), lida no banco por
 * `assistente_categorias()`. O mentor tem as três. A escolha lembrada (`assistente_preferencias`) nunca
 * vale sozinha: passa por `nivelEmUso` contra o teto a cada pergunta.
 */
export const CATEGORIAS = ["basica", "smart", "pro"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** O que a tela da assistente recebe para montar o seletor: o que pode, e o que vale agora. */
export type NiveisDaTela = { permitidas: Categoria[]; atual: Categoria | null };

export const NIVEL: Record<Categoria, { nome: string; explicacao: string }> = {
  basica: {
    nome: "Básica",
    explicacao: "Respostas rápidas e diretas, para as dúvidas do dia a dia.",
  },
  smart: {
    nome: "Smart",
    explicacao:
      "Pensa com mais calma antes de responder: para sugestões, planos e perguntas mais elaboradas.",
  },
  pro: {
    nome: "Pro",
    explicacao:
      "A mais precisa e assertiva, para quando cada detalhe importa. Pode demorar um pouco mais.",
  },
};

export function ehCategoria(v: unknown): v is Categoria {
  return typeof v === "string" && (CATEGORIAS as readonly string[]).includes(v);
}

/** Só os níveis válidos, na ordem da escada (Básica → Smart → Pro), sem repetição. */
export function naOrdem(lista: readonly unknown[] | null | undefined): Categoria[] {
  const presentes = new Set(lista ?? []);
  return CATEGORIAS.filter((c) => presentes.has(c));
}

/** "Básica, Pro" — para frases na tela. */
export function nomesDosNiveis(lista: readonly Categoria[]): string {
  return lista.length ? lista.map((c) => NIVEL[c].nome).join(", ") : "nenhum";
}

/**
 * O nível que vale para esta pergunta: o escolhido, se ainda estiver dentro do teto; senão o mais baixo
 * liberado — a Básica, sempre que ela estiver liberada. Teto vazio = `null` (a assistente está fechada).
 * Uma escolha antiga que o teto não cobre mais (o mentor tirou a Pro) é ignorada, nunca vira erro.
 */
export function nivelEmUso(permitidas: readonly Categoria[], escolhida: unknown): Categoria | null {
  const teto = naOrdem(permitidas);
  if (!teto.length) return null;
  return ehCategoria(escolhida) && teto.includes(escolhida) ? escolhida : teto[0];
}
