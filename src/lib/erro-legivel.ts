/**
 * #263 — o tradutor central de erro de validação.
 *
 * Um `inputValidator` que faz `schema.parse(d)` e recusa o valor lança um
 * ZodError. `ZodError.message` é o `JSON.stringify` das issues — é assim que
 * a própria classe funciona, não é um acidente de serialização. Do lado do
 * servidor (`createServerFn`), esse erro cruza a rede serializado pelo
 * TanStack Start: só `.message` sobrevive (confirmado inspecionando o
 * payload de rede — o `.issues` de verdade, estruturado, não chega ao
 * navegador). O que sobra do outro lado é essa string de JSON inteira, e
 * `toast.error(e.message)` mostra exatamente isso: um bloco de código.
 *
 * `mensagemDeErro` reconhece esse formato dos dois lados — ZodError de
 * verdade (server, antes de cruzar a rede) e o `.message` já stringificado
 * (client, depois de cruzar) — e devolve uma frase pronta. Quando não
 * reconhece nada (erro inesperado), devolve uma frase honesta genérica e
 * manda o detalhe pro console — nunca o bloco técnico pra tela.
 *
 * Mensagem já escrita à mão em português (a maioria dos `throw new
 * Error("...")` da plataforma, incluindo as travas de banco) passa direto,
 * sem mudar nada — só o formato cru de Zod (ou algo igualmente ilegível) é
 * traduzido.
 */

type ZodIssueLike = {
  code?: string;
  origin?: string;
  format?: string;
  path?: Array<string | number>;
  message?: string;
  minimum?: number;
  maximum?: number;
};

const MENSAGEM_PADRAO = "Não foi possível salvar. Tente de novo — se continuar, me avise.";

/**
 * @param erro O que foi pego no catch/onError — tipo `unknown` de propósito.
 * @param labels Nome de tela para o(s) campo(s) do schema (ex.: `{ link_url: "Link da chamada" }`).
 *   Sem isto, a frase não cita o campo — nunca cita o nome interno.
 * @param fallback Frase para quando o erro não é reconhecido. Usar uma
 *   específica da tela quando fizer sentido ("Falha ao enviar o banner.");
 *   senão fica a genérica.
 */
export function mensagemDeErro(
  erro: unknown,
  labels?: Record<string, string>,
  fallback: string = MENSAGEM_PADRAO,
): string {
  const issues = extrairIssuesDeZod(erro);
  if (issues && issues.length > 0) {
    return formatarIssue(issues[0], labels);
  }

  if (erro instanceof Error && erro.message && !pareceTecnico(erro.message)) {
    return erro.message;
  }

  console.error(erro);
  return fallback;
}

function extrairIssuesDeZod(erro: unknown): ZodIssueLike[] | null {
  // ZodError de verdade — ainda do lado do servidor, ou um safeParse local.
  if (
    erro &&
    typeof erro === "object" &&
    "issues" in erro &&
    Array.isArray((erro as { issues: unknown }).issues)
  ) {
    return (erro as { issues: ZodIssueLike[] }).issues;
  }

  // Depois de cruzar a rede, só o `.message` sobrevive — e é o JSON das
  // issues quando a causa foi validação. Tenta reconhecer esse formato
  // antes de desistir e cair no genérico.
  if (erro instanceof Error) {
    const texto = erro.message.trim();
    if (texto.startsWith("[") || texto.startsWith("{")) {
      try {
        const parsed: unknown = JSON.parse(texto);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        if (arr.length > 0 && arr.every((i) => i && typeof i === "object" && "code" in i)) {
          return arr as ZodIssueLike[];
        }
      } catch {
        // Não era JSON de issues — é mensagem normal, segue o fluxo abaixo.
      }
    }
  }
  return null;
}

/** JSON cru (issues não reconhecidas, ou qualquer outro bloco técnico) nunca vira tela. */
function pareceTecnico(msg: string): boolean {
  const t = msg.trim();
  return t === "" || t.startsWith("[") || t.startsWith("{");
}

function nomeDoCampo(issue: ZodIssueLike, labels?: Record<string, string>): string | null {
  const path = issue.path;
  if (!path || path.length === 0 || !labels) return null;
  const chave = path.join(".");
  return labels[chave] ?? labels[String(path[path.length - 1])] ?? null;
}

function primeiraMinuscula(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}

function formatarIssue(issue: ZodIssueLike, labels?: Record<string, string>): string {
  const campo = nomeDoCampo(issue, labels);
  const generica = mensagemGenerica(issue);
  return campo ? `${campo}: ${primeiraMinuscula(generica)}` : generica;
}

/** Cobre os casos do #263: obrigatório vazio, curto/longo demais, e-mail,
 * link, número fora do intervalo, data inválida, tipo errado. Mensagem de
 * `.refine()` (code "custom") já costuma estar escrita à mão em português
 * nesta base (ver `url-segura.ts`) — usa como está em vez de reescrever. */
function mensagemGenerica(issue: ZodIssueLike): string {
  if (issue.code === "custom" && issue.message) return issue.message;

  switch (issue.code) {
    case "invalid_type":
      return "Preencha este campo.";
    case "too_small":
      if (issue.origin === "number") return `Digite um número maior ou igual a ${issue.minimum}.`;
      if (issue.origin === "array") return `Selecione pelo menos ${issue.minimum} item(ns).`;
      if ((issue.minimum ?? 0) <= 1) return "Preencha este campo.";
      return `Digite pelo menos ${issue.minimum} caracteres.`;
    case "too_big":
      if (issue.origin === "number") return `Digite um número menor ou igual a ${issue.maximum}.`;
      if (issue.origin === "array") return `Selecione no máximo ${issue.maximum} item(ns).`;
      return `Digite no máximo ${issue.maximum} caracteres.`;
    case "invalid_format":
      if (issue.format === "email") return "Digite um e-mail válido.";
      if (issue.format === "url") return "Digite um endereço válido, começando com http:// ou https://.";
      if (issue.format === "datetime" || issue.format === "date") return "Digite uma data válida.";
      return "O valor não está no formato esperado.";
    case "invalid_value":
      return "Escolha uma das opções disponíveis.";
    default:
      return "Verifique o valor informado.";
  }
}
