/**
 * As contas da lista de presença — num lugar só, e puras.
 *
 * Atraso, situação e frequência NÃO são gravados: saem daqui, do horário da aula
 * e dos check-ins. Guardar cada um criaria três lugares para o mesmo fato
 * divergirem, e mudar a hora da aula deixaria o atraso mentindo.
 *
 * Sem `Date.now()` em lugar nenhum: o instante de referência entra como
 * parâmetro, decidido UMA vez no servidor. Se cada lado olhasse o próprio
 * relógio, a mesma planilha exportada às 19h e às 23h daria números diferentes,
 * e o relógio errado de um notebook mudaria a frequência de uma turma.
 */

/** A partir de quantos minutos a chegada conta como atraso. Aparece na tela. */
export const TOLERANCIA_ATRASO_MIN = 10;

/** Quanto tempo depois do fim a aula ainda aceita check-in (a mesma da janela). */
import { aulaRealizada, type Aula as AulaJanela } from "@/lib/janela";

export type Situacao = "presente" | "atrasado" | "ausente" | "justificado" | "sem_registro";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  presente: "Presente",
  atrasado: "Atrasado",
  ausente: "Ausente",
  justificado: "Falta justificada",
  sem_registro: "Sem registro",
};

export type AulaPresenca = AulaJanela & {
  id: string;
  titulo: string;
  modulo: string;
  local: string | null;
  /** Quando o professor declarou a lista fechada. Nulo = ainda aberta. */
  fechada_em: string | null;
  cancelada: boolean;
};

export type Registro = {
  aula_id: string;
  person_id: string;
  origem: string;
  /** A hora do SCAN. Nulo quando o professor marcou à mão — e aí não há régua. */
  escaneado_em: string | null;
  /** Quando a linha nasceu. Serve de auditoria, nunca de régua de atraso. */
  registrado_em: string;
  situacao: string | null;
  observacao: string | null;
  /** Nome de quem tocou nesta linha, gravado na hora. */
  marcado_por_nome: string | null;
  grupo: string | null;
};

export type Aluno = {
  person_id: string;
  nome: string;
  email: string | null;
  grupo: string | null;
  /** Desde quando conta para ele. Sem isso, quem entrou na 4ª aula deveria 3 faltas. */
  conta_desde: string | null;
  /** Saiu do grupo mas tem presença: a conta dele para na última aula que frequentou. */
  saiu_do_grupo: boolean;
};

/**
 * Minutos depois do início — só quando existe régua.
 *
 * Régua = hora do SCAN e horário da aula. Presença marcada à mão não tem hora de
 * chegada: usar `registrado_em` faria "o professor lançou na manhã seguinte"
 * aparecer como 840 minutos de atraso.
 */
export function atrasoMin(reg: Registro | undefined, aula: AulaPresenca): number | null {
  if (!reg?.escaneado_em || !aula.comeca_em) return null;
  const diff = Math.trunc(
    (new Date(reg.escaneado_em).getTime() - new Date(aula.comeca_em).getTime()) / 60_000,
  );
  return Math.max(0, diff);
}

/** Chegou antes do horário? É informação diferente de "atraso zero". */
export function chegouAntes(reg: Registro | undefined, aula: AulaPresenca): boolean {
  if (!reg?.escaneado_em || !aula.comeca_em) return false;
  return new Date(reg.escaneado_em).getTime() < new Date(aula.comeca_em).getTime();
}

/**
 * A situação, nesta ordem de precedência:
 *
 * 1. o que o professor marcou à mão vence sempre — ele estava na sala;
 * 2. tem presença → atrasado ou presente, pelo atraso;
 * 3. sem presença e lista ainda ABERTA → "sem registro". Não é ausência: pode
 *    ser QR que não subiu, wifi caído, ou lista que ninguém abriu;
 * 4. sem presença e lista fechada → ausente. Aqui alguém afirmou.
 */
export function situacaoDe(reg: Registro | undefined, aula: AulaPresenca): Situacao {
  if (reg?.situacao) return reg.situacao as Situacao;
  if (reg) {
    const atraso = atrasoMin(reg, aula);
    return atraso != null && atraso >= TOLERANCIA_ATRASO_MIN ? "atrasado" : "presente";
  }
  return aula.fechada_em ? "ausente" : "sem_registro";
}

/** Conta como comparecimento? Falta justificada NÃO conta — a tela diz isso. */
export function contaComoPresenca(s: Situacao): boolean {
  return s === "presente" || s === "atrasado";
}

/**
 * A aula entra na conta da frequência?
 *
 * Só a que aconteceu de verdade E foi fechada: sem data não se sabe se
 * aconteceu, cancelada não aconteceu, e aberta ainda não foi afirmada por
 * ninguém. Uma aula fora da conta não vira falta de ninguém.
 */
export function aulaContaNaFrequencia(aula: AulaPresenca, referencia: number): boolean {
  return !aula.cancelada && !!aula.fechada_em && aulaRealizada(aula, referencia);
}

export type Frequencia = {
  presentes: number;
  contadas: number;
  justificadas: number;
  /** "8 de 10" — vazio quando ainda não há aula fechada. */
  texto: string;
  /** Percentual inteiro, ou null quando não há denominador. */
  pct: number | null;
};

/**
 * "8 de 10 aulas" — o número que o RH pergunta.
 *
 * Três recortes, e cada um evita um jeito de a lista mentir:
 *
 * - o denominador conta só aula REALIZADA E FECHADA (ver acima), senão no meio
 *   do treinamento todo mundo pareceria faltoso;
 * - ignora aula anterior à entrada da pessoa na turma — quem entrou na quarta
 *   aula não deve as três de antes;
 * - o numerador é filtrado DENTRO do mesmo conjunto do denominador, nunca à
 *   parte: é o que impede a lista de imprimir "5 de 4" quando uma aula sai da
 *   conta e as presenças dela ficam.
 *
 * `ate` limita a apuração até uma aula específica ("frequência até esta aula"),
 * que é o número honesto para a linha daquela aula.
 */
export function frequenciaDe(
  aluno: Aluno,
  aulas: AulaPresenca[],
  porAula: Map<string, Registro>,
  referencia: number,
  ate?: AulaPresenca,
): Frequencia {
  const desde = aluno.conta_desde ? new Date(aluno.conta_desde).getTime() : null;
  const limite = ate?.comeca_em ? new Date(ate.comeca_em).getTime() : null;

  // Quem saiu da turma para de acumular falta na última aula que frequentou —
  // senão um curso que ele já não faz mais acumularia ausência para sempre.
  let ultimaPresenca: number | null = null;
  if (aluno.saiu_do_grupo) {
    for (const a of aulas) {
      if (!porAula.has(a.id) || !a.comeca_em) continue;
      const t = new Date(a.comeca_em).getTime();
      if (ultimaPresenca == null || t > ultimaPresenca) ultimaPresenca = t;
    }
  }

  let presentes = 0;
  let contadas = 0;
  let justificadas = 0;
  for (const aula of aulas) {
    if (!aulaContaNaFrequencia(aula, referencia)) continue;
    const reg = porAula.get(aula.id);
    const quando = aula.comeca_em ? new Date(aula.comeca_em).getTime() : null;
    if (limite != null && quando != null && quando > limite) continue;
    // A presença sempre conta, mesmo antes da entrada no grupo: é o que garante
    // numerador nunca maior que denominador.
    if (!reg) {
      if (desde != null && quando != null && quando < desde) continue;
      if (ultimaPresenca != null && quando != null && quando > ultimaPresenca) continue;
    }
    contadas++;
    const s = situacaoDe(reg, aula);
    if (contaComoPresenca(s)) presentes++;
    if (s === "justificado") justificadas++;
  }

  return {
    presentes,
    contadas,
    justificadas,
    texto: contadas === 0 ? "—" : `${presentes} de ${contadas}`,
    pct: contadas === 0 ? null : Math.round((presentes / contadas) * 100),
  };
}

// ============================================================
// Formatação — a mesma na tela e no arquivo
// ============================================================
const FUSO = "America/Sao_Paulo";

export function quandoBr(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function horaBr(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: FUSO, hour: "2-digit", minute: "2-digit",
  });
}

/** Data e hora com o fuso escrito: a planilha viaja para fora da tela. */
export function quandoComFuso(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (v: string) => v.padStart(2, "0");
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${p(g("month"))}-${p(g("day"))} ${p(g("hour"))}:${p(g("minute"))} -03:00`;
}

/** O texto da coluna "Chegada" na tela. */
export function textoChegada(reg: Registro | undefined): string {
  if (!reg) return "";
  if (reg.escaneado_em) return quandoBr(reg.escaneado_em);
  return `— (lançado ${horaBr(reg.registrado_em)})`;
}

/** O texto da coluna "Atraso" na tela. Número só quando é atraso de verdade. */
export function textoAtraso(reg: Registro | undefined, aula: AulaPresenca): string {
  if (!reg) return "";
  if (!reg.escaneado_em) return "—";
  if (!aula.comeca_em) return "sem horário na aula";
  if (chegouAntes(reg, aula)) return "chegou antes";
  const m = atrasoMin(reg, aula) ?? 0;
  return m === 0 ? "na hora" : `${m} min`;
}

/**
 * "Como foi registrada" — descritivo, nunca acusatório.
 *
 * Registro pelo professor é caminho previsto para quem não tem celular, senha ou
 * sinal; a coluna informa o meio, não levanta suspeita. E ausência sem check-in
 * não é "registrada pelo professor": é ausência de registro.
 */
export function textoOrigem(reg: Registro | undefined): string {
  if (!reg) return "";
  if (reg.origem === "qr") return "Confirmada pelo aluno (QR)";
  return "Registrada pelo professor";
}

/** A situação foi decidida à mão, contra o que o cálculo diria? */
export function ehOverride(reg: Registro | undefined, aula: AulaPresenca): boolean {
  if (!reg?.situacao) return false;
  const semOverride = { ...reg, situacao: null };
  return reg.situacao !== situacaoDe(semOverride, aula);
}
