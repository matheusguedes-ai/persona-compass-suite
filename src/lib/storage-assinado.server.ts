/**
 * Assina URLs de arquivo dos buckets privados 'biblioteca' e 'avatares'.
 *
 * O que fica gravado no banco continua sendo a URL no formato que
 * `getPublicUrl()` monta no navegador
 * (https://<projeto>.supabase.co/storage/v1/object/public/<bucket>/<caminho>).
 * Isso não muda — é só um IDENTIFICADOR de bucket+caminho. Ela nunca mais é
 * usada direto: aqui, na hora de responder ao cliente, vira uma URL ASSINADA
 * e com prazo, minerada pela service role.
 *
 * Link EXTERNO (Google Drive, YouTube etc — o modo "link" da tela) não bate
 * com o padrão do NOSSO domínio de storage, então passa direto, sem tentar
 * assinar. A checagem é sobre uma coisa técnica e estável (é ou não é uma URL
 * do nosso próprio storage) — diferente da checagem de UI que existia em
 * biblioteca.tsx (que tentava adivinhar em qual MODO a pessoa editou o
 * material, e essa foi substituída pela coluna `arquivo_proprio`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Material, capa e banner: refeita a cada carregamento de tela, prazo curto. */
export const TTL_ARQUIVO_SEGUNDOS = 10 * 60;
/** Avatar: aparece em várias listas ao mesmo tempo; prazo maior evita foto quebrada em navegação normal. */
export const TTL_AVATAR_SEGUNDOS = 60 * 60;

const PADRAO_NOSSO_STORAGE = /\/storage\/v1\/object\/public\/(biblioteca|avatares)\/(.+)$/;

/** Exportada para quem precisa decidir algo sobre bucket+caminho antes de assinar (ex.: checar dono). */
export function partirUrl(url: string): { bucket: "biblioteca" | "avatares"; caminho: string } | null {
  const m = url.match(PADRAO_NOSSO_STORAGE);
  if (!m) return null;
  return { bucket: m[1] as "biblioteca" | "avatares", caminho: decodeURIComponent(m[2]) };
}

/**
 * Assina uma URL só.
 *
 * `null`/vazio → `null`. Link externo → devolvido como veio. URL do nosso
 * storage → assinada. Se a assinatura falhar (arquivo apagado do bucket,
 * caminho inválido), devolve `null` em vez de repassar a URL pública morta —
 * um material sem link é visível como "sem link"; um material com link que
 * não abre parece bug.
 */
export async function assinarUrl(
  admin: SupabaseClient,
  url: string | null | undefined,
  ttlSegundos: number,
): Promise<string | null> {
  if (!url) return null;
  const alvo = partirUrl(url);
  if (!alvo) return url;
  const { data, error } = await admin.storage.from(alvo.bucket).createSignedUrl(alvo.caminho, ttlSegundos);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

const PADRAO_URL_ASSINADA = /\/storage\/v1\/object\/sign\/(biblioteca|avatares)\//;

/**
 * É uma URL ASSINADA (a de exibir), não o identificador cru (a de gravar)?
 *
 * Todo formulário de edição carrega o valor atual a partir do que a tela de
 * listagem devolveu — e a listagem agora devolve sempre a versão assinada,
 * para poder desenhar a imagem. Quem edita o título de um material sem trocar
 * a capa reenviaria esse mesmo valor assinado no salvar. Sem esta checagem, o
 * identificador gravado no banco vira um link com prazo — funciona por alguns
 * minutos e depois quebra sozinho, sem nenhuma ação visível que explique.
 *
 * Quem grava (`salvarMaterial`, `salvarPasta`, `saveMaterialAula`,
 * `upsertMyProfile`, `updateMyStudentProfile`) usa isto para perceber a
 * situação e preservar o identificador que já estava gravado.
 */
export function ehUrlAssinadaNossa(url: string | null | undefined): boolean {
  return !!url && PADRAO_URL_ASSINADA.test(url);
}

/**
 * Assina várias de uma vez. Uma chamada por bucket em vez de uma por arquivo —
 * a tela de biblioteca list pode ter dezenas de materiais na mesma resposta.
 * Preserva a posição de cada item e os `null`/link-externo.
 */
export async function assinarUrls(
  admin: SupabaseClient,
  urls: Array<string | null | undefined>,
  ttlSegundos: number,
): Promise<Array<string | null>> {
  const resultado: Array<string | null> = urls.map((u) => u ?? null);
  const porBucket = new Map<"biblioteca" | "avatares", Array<{ idx: number; caminho: string }>>();

  urls.forEach((u, idx) => {
    if (!u) return;
    const alvo = partirUrl(u);
    if (!alvo) { resultado[idx] = u; return; } // link externo — passa direto
    const lista = porBucket.get(alvo.bucket) ?? [];
    lista.push({ idx, caminho: alvo.caminho });
    porBucket.set(alvo.bucket, lista);
  });

  for (const [bucket, itens] of porBucket) {
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrls(itens.map((i) => i.caminho), ttlSegundos);
    if (error || !data) {
      itens.forEach((i) => { resultado[i.idx] = null; });
      continue;
    }
    data.forEach((linha, i) => {
      resultado[itens[i].idx] = linha.error ? null : (linha.signedUrl ?? null);
    });
  }
  return resultado;
}

export type ArquivoMentoriaParaAssinar = {
  id: string; nome: string; caminho: string; tamanho_bytes: number; tipo: string;
};
export type ArquivoMentoriaAssinado = {
  id: string; nome: string; tamanho_bytes: number; tipo: string; url: string | null;
};

/**
 * Assina os anexos de mentoria: bucket 'mentorias' privado, sem nenhuma
 * policy de SELECT em storage.objects — diferente de biblioteca/avatares,
 * `mentoria_arquivos.caminho` já guarda o caminho CRU (não uma URL), então
 * não passa por `partirUrl`. O `caminho` nunca sai desta função: só a URL
 * assinada, com prazo, chega ao cliente.
 */
export async function assinarArquivosMentoria(
  admin: SupabaseClient,
  arquivos: ArquivoMentoriaParaAssinar[],
): Promise<ArquivoMentoriaAssinado[]> {
  if (arquivos.length === 0) return [];
  const { data, error } = await admin.storage
    .from("mentorias")
    .createSignedUrls(arquivos.map((a) => a.caminho), TTL_ARQUIVO_SEGUNDOS);
  return arquivos.map((a, i) => ({
    id: a.id,
    nome: a.nome,
    tamanho_bytes: a.tamanho_bytes,
    tipo: a.tipo,
    url: error || !data ? null : (data[i]?.error ? null : (data[i]?.signedUrl ?? null)),
  }));
}
