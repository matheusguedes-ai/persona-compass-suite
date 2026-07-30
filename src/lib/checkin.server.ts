/**
 * O miolo do check-in: o código do QR e o passe que atravessa o login.
 *
 * Duas garantias, e vale ser honesto sobre qual é qual:
 *
 * 1. O CÓDIGO rotativo é a trava de fraude. Ele vale ~1 minuto, então a foto do
 *    QR mandada no WhatsApp chega morta. O que ele compra, exatamente, é
 *    obrigar o cúmplice a estar SÍNCRONO — não dá mais para fotografar de manhã
 *    e usar de noite. Quem repassar a URL ao vivo, dentro do minuto, ainda passa;
 *    contra isso o backstop é o olho do professor e a lista na tela dele.
 *
 * 2. O PASSE em cookie NÃO é trava de fraude — é ponte de usabilidade. Entre
 *    escanear e confirmar, o aluno passa pelo login, e a sessão do Supabase vive
 *    em localStorage (Bearer), não em cookie: o servidor não sabe quem é ninguém
 *    no request do documento. O passe é o que carrega "esta pessoa escaneou o
 *    código de verdade" até a chamada autenticada. Ele é de uso único (o nonce
 *    tem índice UNIQUE na tabela de presenças) porque senão um celular
 *    emprestado viraria a turma inteira: logar como A, confirmar, sair, logar
 *    como B…
 *
 * Nada disso guarda segredo no banco. A chave é a mesma que assina o `state` do
 * OAuth do Google (src/lib/google.server.ts) — se ela faltasse, o login do
 * Google e os relatórios públicos já estariam fora do ar.
 */
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

/** Um código por minuto. Ver TOLERANCIA_BUCKETS para a validade real. */
export const BUCKET_SEGUNDOS = 60;

/**
 * Aceita o minuto atual e o anterior — validade real de 60 a 120 segundos.
 *
 * Não é folga para relógio: os dois lados calculam o bucket no SERVIDOR. É folga
 * para o caminho do scan até o servidor, que numa sala com wifi ruim leva de 3 a
 * 40 segundos (tocar o banner do Safari, abrir o navegador, DNS, TLS). Sem isso
 * o check-in falha justamente no minuto em que a sala enche.
 *
 * Bucket FUTURO nunca é aceito.
 */
const TOLERANCIA_BUCKETS = 1;

/** Quanto tempo o passe vale. Só precisa cobrir um login digitado no celular. */
export const PASSE_MINUTOS = 10;

function chave(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Sem chave para assinar o check-in.");
  return k;
}

function hmac(mensagem: string): Buffer {
  return createHmac("sha256", chave()).update(mensagem).digest();
}

function base64url(b: Buffer): string {
  return b.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** Comparação de tempo constante — `===` vazaria, pelo tempo, quanto bateu. */
function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function bucketAgora(agora = Date.now()): number {
  return Math.floor(agora / 1000 / BUCKET_SEGUNDOS);
}

/**
 * O código do QR para uma aula num minuto.
 *
 * 16 bytes (128 bits) em base64url, sem truncar. O endpoint que valida é público
 * e sem limite de tentativas — código curto viraria oráculo de força bruta ao
 * longo de duas horas de aula. E comprimento é grátis: ninguém digita isto, é
 * câmera lendo.
 */
export function codigoDaAula(aulaId: string, bucket: number): string {
  return base64url(hmac(`checkin.${aulaId}.${bucket}`).subarray(0, 16));
}

/** O código confere para o minuto atual ou o anterior? */
export function codigoValido(aulaId: string, codigo: string, agora = Date.now()): boolean {
  const b = bucketAgora(agora);
  for (let i = 0; i <= TOLERANCIA_BUCKETS; i++) {
    if (iguais(codigo, codigoDaAula(aulaId, b - i))) return true;
  }
  return false;
}

/** Quando o código atual morre — a tela do professor usa para se renovar na hora. */
export function fimDoBucket(agora = Date.now()): number {
  return (bucketAgora(agora) + 1) * BUCKET_SEGUNDOS * 1000;
}

// A janela da aula mora em `@/lib/janela` — sem nada de servidor dentro, porque
// a tabela de presença precisa da mesma aritmética no navegador.
export { janelaDaAula, dentroDaJanela, MARGEM_ANTES_MIN, MARGEM_DEPOIS_MIN } from "@/lib/janela";

// ============================================================
// O passe
// ============================================================
export const COOKIE_PREFIXO = "ck_";

/** Um cookie por aula: escanear a segunda aula não pode apagar o passe da primeira. */
export function nomeDoCookie(aulaId: string): string {
  return `${COOKIE_PREFIXO}${aulaId}`;
}

export type Passe = { escaneadoEm: number; expira: number; nonce: string };

/**
 * Assina o passe. A expiração e o nonce entram DENTRO da mensagem do HMAC —
 * fora dela, seriam campos que qualquer um edita, e o passe nunca venceria.
 */
export function assinarPasse(aulaId: string, agora = Date.now()): string {
  const p: Passe = {
    escaneadoEm: agora,
    expira: agora + PASSE_MINUTOS * 60_000,
    nonce: base64url(randomBytes(16)),
  };
  const corpo = `${p.escaneadoEm}.${p.expira}.${p.nonce}`;
  return `${corpo}.${base64url(hmac(`passe.${aulaId}.${corpo}`))}`;
}

/** Devolve o passe se a assinatura confere e ele não venceu; senão null. */
export function lerPasse(aulaId: string, valor: string | undefined | null, agora = Date.now()): Passe | null {
  if (!valor) return null;
  const partes = valor.split(".");
  if (partes.length !== 4) return null;
  const [escaneadoEm, expira, nonce, assinatura] = partes;
  const corpo = `${escaneadoEm}.${expira}.${nonce}`;
  if (!iguais(assinatura, base64url(hmac(`passe.${aulaId}.${corpo}`)))) return null;
  const exp = Number(expira);
  const scan = Number(escaneadoEm);
  if (!Number.isFinite(exp) || !Number.isFinite(scan) || exp < agora) return null;
  return { escaneadoEm: scan, expira: exp, nonce };
}

/** O cabeçalho do cookie do passe. `Path=/` porque a confirmação vai para /_serverFn. */
export function cookieDoPasse(aulaId: string, valor: string, seguro: boolean): string {
  const flags = [
    `${nomeDoCookie(aulaId)}=${valor}`,
    "Path=/",
    "HttpOnly",
    // Lax, e não Strict: a volta do login com Google é navegação de outro site,
    // e com Strict o cookie não viria junto.
    "SameSite=Lax",
    `Max-Age=${PASSE_MINUTOS * 60}`,
  ];
  // Em localhost (http) o Secure impediria o cookie de ser gravado.
  if (seguro) flags.push("Secure");
  return flags.join("; ");
}

/** Lê um cookie do cabeçalho cru — o projeto não tem infra de cookie ainda. */
export function cookieDaRequisicao(cabecalho: string | null, nome: string): string | null {
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(";")) {
    const corte = parte.indexOf("=");
    if (corte < 0) continue;
    if (parte.slice(0, corte).trim() === nome) return parte.slice(corte + 1).trim();
  }
  return null;
}
