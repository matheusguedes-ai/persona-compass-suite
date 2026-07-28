/**
 * Leitura de planilha para importar pessoas.
 *
 * Aceita `.xlsx` (Excel) e `.csv`. O CSV é lido aqui mesmo — é formato simples e
 * não vale uma dependência; o Excel usa `read-excel-file`, carregado sob demanda
 * para não pesar no carregamento de quem nunca importa planilha.
 */

export type LinhaPlanilha = {
  /** Número da linha no arquivo, contando o cabeçalho — é o que a pessoa vê no Excel. */
  linha: number;
  full_name: string;
  email: string;
  phone: string;
  profession: string;
  role_at_company: string;
  /** Vazio quando a linha está boa. */
  erro?: string;
};

/**
 * Nomes de coluna aceitos. Cada planilha vem de um jeito, e obrigar um cabeçalho
 * exato só geraria retrabalho — então reconhecemos as variações comuns.
 */
const COLUNAS: Record<keyof Omit<LinhaPlanilha, "linha" | "erro">, string[]> = {
  full_name: ["nome", "nome completo", "name", "full name", "full_name", "colaborador", "funcionario", "funcionário"],
  email: ["email", "e-mail", "e mail", "correio", "mail"],
  phone: ["telefone", "celular", "fone", "phone", "whatsapp", "whats"],
  profession: ["profissao", "profissão", "profession", "formacao", "formação"],
  role_at_company: ["cargo", "funcao", "função", "role", "posicao", "posição", "cargo na empresa"],
};

/** tira acento, espaço extra e caixa — para casar cabeçalho escrito de qualquer jeito */
function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function acharColuna(cabecalho: string[], nomes: string[]): number {
  const norm = cabecalho.map(normalizar);
  const alvos = nomes.map(normalizar);
  for (let i = 0; i < norm.length; i++) if (alvos.includes(norm[i])) return i;
  // Segunda passada, mais frouxa: "nome do colaborador" casa com "nome".
  for (let i = 0; i < norm.length; i++) if (alvos.some((a) => norm[i].includes(a))) return i;
  return -1;
}

/**
 * CSV com aspas, vírgula dentro de campo e quebra de linha dentro de aspas.
 * Detecta se o separador é vírgula ou ponto e vírgula — o Excel em português
 * salva com ponto e vírgula, e é o erro mais comum de quem exporta daqui.
 */
export function lerCsv(texto: string): string[][] {
  const semBom = texto.replace(/^\uFEFF/, "");
  const primeiraLinha = semBom.slice(0, semBom.indexOf("\n") < 0 ? undefined : semBom.indexOf("\n"));
  const sep = (primeiraLinha.match(/;/g)?.length ?? 0) > (primeiraLinha.match(/,/g)?.length ?? 0) ? ";" : ",";

  const linhas: string[][] = [];
  let campo = "";
  let atual: string[] = [];
  let dentroDeAspas = false;

  for (let i = 0; i < semBom.length; i++) {
    const c = semBom[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (semBom[i + 1] === '"') { campo += '"'; i++; }
        else dentroDeAspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { dentroDeAspas = true; continue; }
    if (c === sep) { atual.push(campo); campo = ""; continue; }
    if (c === "\n") { atual.push(campo); linhas.push(atual); atual = []; campo = ""; continue; }
    if (c === "\r") continue;
    campo += c;
  }
  if (campo.length > 0 || atual.length > 0) { atual.push(campo); linhas.push(atual); }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

async function lerXlsx(file: File): Promise<string[][]> {
  // Subcaminho /browser de propósito: o pacote não tem entrada raiz, e a versão
  // node tentaria usar `fs`, que não existe aqui.
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const linhas = (await readXlsxFile(file)) as unknown as unknown[][];
  return linhas.map((l) => l.map((c) => (c == null ? "" : String(c))));
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Lê o arquivo e devolve as linhas já validadas.
 *
 * Não recusa a planilha inteira por causa de uma linha ruim: marca o erro na
 * linha e deixa o mentor decidir. Numa importação de 80 funcionários, travar
 * tudo porque um email está errado seria péssimo.
 */
export async function lerPlanilhaDePessoas(file: File): Promise<{ linhas: LinhaPlanilha[]; aviso?: string }> {
  const ehExcel = /\.xlsx$/i.test(file.name);
  const ehCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  if (!ehExcel && !ehCsv) {
    throw new Error("Formato não reconhecido. Envie um arquivo .xlsx (Excel) ou .csv.");
  }
  if (/\.xls$/i.test(file.name)) {
    throw new Error("Este é um Excel antigo (.xls). Abra no Excel e salve como .xlsx.");
  }

  const grade = ehExcel ? await lerXlsx(file) : lerCsv(await file.text());
  if (grade.length === 0) throw new Error("A planilha está vazia.");

  const cabecalho = grade[0].map((c) => String(c ?? ""));
  const idx = {
    full_name: acharColuna(cabecalho, COLUNAS.full_name),
    email: acharColuna(cabecalho, COLUNAS.email),
    phone: acharColuna(cabecalho, COLUNAS.phone),
    profession: acharColuna(cabecalho, COLUNAS.profession),
    role_at_company: acharColuna(cabecalho, COLUNAS.role_at_company),
  };

  if (idx.full_name < 0 || idx.email < 0) {
    throw new Error(
      "Não encontrei as colunas de nome e email. A primeira linha da planilha precisa ser o cabeçalho, " +
        "com uma coluna chamada “Nome” e outra “Email”. Baixe o modelo para conferir o formato.",
    );
  }

  const pega = (l: string[], i: number) => (i >= 0 ? String(l[i] ?? "").trim() : "");
  const vistos = new Set<string>();
  const linhas: LinhaPlanilha[] = [];

  for (let i = 1; i < grade.length; i++) {
    const l = grade[i];
    const full_name = pega(l, idx.full_name);
    const email = pega(l, idx.email).toLowerCase();
    const item: LinhaPlanilha = {
      linha: i + 1,
      full_name,
      email,
      phone: pega(l, idx.phone),
      profession: pega(l, idx.profession),
      role_at_company: pega(l, idx.role_at_company),
    };

    if (!full_name && !email) continue; // linha em branco no meio da planilha
    if (!full_name) item.erro = "sem nome";
    else if (!email) item.erro = "sem email";
    else if (!EMAIL_OK.test(email)) item.erro = "email inválido";
    else if (vistos.has(email)) item.erro = "email repetido na planilha";
    if (!item.erro) vistos.add(email);

    linhas.push(item);
  }

  if (linhas.length === 0) throw new Error("A planilha tem cabeçalho, mas nenhuma pessoa listada.");
  return { linhas };
}

/** Modelo em CSV, com ponto e vírgula: é o que o Excel em pt-BR abre em colunas. */
export function csvModelo(): string {
  return [
    "Nome;Email;Telefone;Profissão;Cargo",
    "Maria da Silva;maria@empresa.com.br;(11) 99999-0000;Psicóloga;Gerente de RH",
    "João Pereira;joao@empresa.com.br;(11) 98888-1111;Administrador;Analista",
  ].join("\n");
}
