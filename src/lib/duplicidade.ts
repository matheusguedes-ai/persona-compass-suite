/**
 * #300 — reconhecer a mesma pessoa chegando com outro e-mail.
 *
 * Funções puras, sem banco. Duas telas usam: o link aberto (antes de criar um
 * cadastro novo) e a ferramenta do mentor que lista prováveis duplicados.
 *
 * Calibrado nos três casos reais da aula de 22/09 (Robson, Luana, Sabrina):
 * nos três, o telefone era idêntico ao do cadastro original — é o sinal mais
 * forte que existe aqui. O nome serve de segundo sinal, com regra deliberada-
 * mente estreita: primeiro nome E último sobrenome batendo. Nome de uma
 * palavra só nunca conta — "Camila" sozinho casaria com meio mundo.
 *
 * Falso positivo custa pouco (a pessoa responde "não, sou novo" e o mentor
 * descarta a suspeita). Falso negativo custa um cadastro duplicado com as
 * respostas dela penduradas no lugar errado — foi o que aconteceu na aula.
 */

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "d"]);

export function normalizarEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Só dígitos, sem o +55 e sem zero de discagem na frente. */
export function normalizarTelefone(tel: string | null | undefined): string {
  let d = (tel ?? "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.replace(/^0+/, "");
}

/**
 * Mesmo número, tolerando a mesma pessoa escrever com e sem DDD, com e sem o
 * nono dígito. Os 8 dígitos finais precisam bater; se os dois têm DDD, o DDD
 * também — 8 dígitos iguais com DDDs diferentes são números diferentes.
 */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizarTelefone(a);
  const y = normalizarTelefone(b);
  if (x.length < 8 || y.length < 8) return false;
  if (x.slice(-8) !== y.slice(-8)) return false;
  const ddd = (s: string) => (s.length >= 10 ? s.slice(0, 2) : null);
  const dx = ddd(x);
  const dy = ddd(y);
  return !(dx && dy && dx !== dy);
}

export function tokensDoNome(nome: string | null | undefined): string[] {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !PARTICULAS.has(t));
}

function distancia(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return linha[b.length];
}

/** Igual, ou uma letra de diferença em palavra de 5+ letras ("Rossi"/"Rosi" não; "Timoteo"/"Timotio" sim). */
function quaseIgual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  return distancia(a, b) <= 1;
}

/**
 * Primeiro nome igual E (último sobrenome igual OU todos os sobrenomes do nome
 * mais curto presentes no mais longo). "Sabrina Timóteo" × "Sabrina Bento
 * Timoteo" casa; "Ana Souza" × "Ana Lima" não.
 */
export function nomesParecidos(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = tokensDoNome(a);
  const tb = tokensDoNome(b);
  if (ta.length < 2 || tb.length < 2) return false;
  if (!quaseIgual(ta[0], tb[0])) return false;
  if (quaseIgual(ta[ta.length - 1], tb[tb.length - 1])) return true;
  const [curto, longo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return curto.slice(1).every((t) => longo.slice(1).some((u) => quaseIgual(t, u)));
}

export type MotivoSuspeita = "telefone" | "nome" | "telefone_e_nome";

export function motivoDeSuspeita(
  a: { full_name: string | null; phone: string | null },
  b: { full_name: string | null; phone: string | null },
): MotivoSuspeita | null {
  const tel = mesmoTelefone(a.phone, b.phone);
  const nome = nomesParecidos(a.full_name, b.full_name);
  if (tel && nome) return "telefone_e_nome";
  if (tel) return "telefone";
  if (nome) return "nome";
  return null;
}
