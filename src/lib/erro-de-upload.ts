/**
 * O erro do Supabase Storage, dito em português e com o número certo.
 *
 * Sete pontos da plataforma faziam `toast.error(error.message)` com o texto cru
 * do Supabase. Quando o bucket recusa, a pessoa lê:
 *
 *   "mime type application/pdf is not supported"
 *   "The object exceeded the maximum allowed size"
 *
 * Em inglês, sem dizer qual formato serve nem qual é o limite — e depois de a
 * própria tela ter oferecido aquele arquivo no seletor. O upload falha, o post
 * ou o material é salvo sem o anexo, e a conclusão razoável de quem está do
 * outro lado é "a plataforma comeu o arquivo".
 */

export type LimiteDoBucket = {
  /** Em MB, o mesmo número que o bucket aplica. */
  tamanhoMb: number;
  /** Como dizer os formatos aceitos, em linguagem de gente. */
  formatos: string;
};

/**
 * Espelha `storage.buckets` (migrações 20260730300000 e 20260730360000).
 *
 * Duplicação consciente: o navegador não lê a configuração do bucket, e a
 * alternativa seria descobrir o limite errando. Se mudar lá, muda aqui — é para
 * isso que este comentário existe.
 */
export const LIMITES: Record<string, LimiteDoBucket> = {
  comunidade: { tamanhoMb: 8, formatos: "imagem (JPG, PNG, WEBP, GIF, HEIC) ou PDF" },
  eventos: { tamanhoMb: 5, formatos: "imagem (JPG, PNG, WEBP, HEIC)" },
  biblioteca: {
    tamanhoMb: 50,
    formatos: "PDF, planilha, documento, apresentação ou imagem",
  },
  avatares: { tamanhoMb: 2, formatos: "imagem (JPG, PNG, WEBP)" },
  marca: { tamanhoMb: 2, formatos: "imagem (JPG, PNG, WEBP, SVG)" },
  mentorias: {
    tamanhoMb: 20,
    formatos: "PDF, planilha, documento, apresentação ou imagem",
  },
};

/** O `accept` do input, derivado do que o bucket realmente aceita. */
export const ACCEPT: Record<string, string> = {
  comunidade: "image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,application/pdf",
  eventos: "image/png,image/jpeg,image/webp,image/heic,image/heif",
  biblioteca:
    "application/pdf,image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif," +
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel," +
    "text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
    "application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation," +
    "application/vnd.ms-powerpoint,text/plain,application/zip",
  mentorias:
    "application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif," +
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel," +
    "text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
    "application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation," +
    "application/vnd.ms-powerpoint,text/plain",
  avatares: "image/png,image/jpeg,image/webp",
  marca: "image/png,image/jpeg,image/webp,image/svg+xml",
};

/**
 * #283 — um lugar só para declarar o que cada TELA de envio de imagem aceita e
 * exibe, para não repetir "PNG ou JPEG, até 3 MB" à mão em dez componentes.
 *
 * O tamanho e o formato aqui não são inventados: `tamanhoMb`, quando presente,
 * é o mesmo número que a tela já aplicava antes desta config existir (a #283
 * pediu para INFORMAR os limites, não mudá-los); ausente, cai no limite do
 * bucket inteiro (`LIMITES`). `formatos` é só a mesma lista em português —
 * várias telas aceitam apenas uma FATIA do que o bucket permite (ex.: o bucket
 * 'biblioteca' também guarda PDF e planilha, que não servem como capa).
 *
 * `pixels` existe só nos três campos com medida recomendada pelo dono do
 * produto (26/08) — os demais ficam sem, e o aviso sai só com formato e
 * tamanho.
 */
export type CampoDeImagem =
  | "avatar" | "banner_perfil" | "capa_treinamento" | "capa_trilha" | "capa_material"
  | "banner_evento" | "logo_marca" | "icone_marca" | "imagem_login" | "imagem_post"
  | "banner_academy";

type ConfigDoCampo = {
  bucket: keyof typeof LIMITES;
  tamanhoMb?: number;
  formatos: string;
  accept: string;
  pixels?: { largura: number; altura: number };
};

export const CAMPOS: Record<CampoDeImagem, ConfigDoCampo> = {
  avatar: {
    bucket: "avatares", formatos: "PNG, JPEG ou WEBP", accept: ACCEPT.avatares,
    pixels: { largura: 400, altura: 400 },
  },
  banner_perfil: {
    bucket: "avatares", formatos: "PNG, JPEG ou WEBP", accept: ACCEPT.avatares,
    pixels: { largura: 1200, altura: 300 },
  },
  capa_treinamento: {
    bucket: "biblioteca", tamanhoMb: 3, formatos: "PNG ou JPEG", accept: "image/png,image/jpeg",
    pixels: { largura: 1200, altura: 600 },
  },
  capa_trilha: {
    bucket: "biblioteca", tamanhoMb: 3, formatos: "PNG ou JPEG", accept: "image/png,image/jpeg",
    pixels: { largura: 1200, altura: 600 },
  },
  capa_material: {
    bucket: "biblioteca", tamanhoMb: 3, formatos: "PNG ou JPEG", accept: "image/png,image/jpeg",
  },
  banner_evento: {
    bucket: "eventos", tamanhoMb: 3, formatos: "PNG ou JPEG", accept: "image/png,image/jpeg",
  },
  logo_marca: { bucket: "marca", formatos: "PNG, JPEG, WEBP ou SVG", accept: ACCEPT.marca },
  icone_marca: {
    bucket: "marca", formatos: "PNG, JPEG ou WEBP", accept: "image/png,image/jpeg,image/webp",
  },
  imagem_login: {
    bucket: "marca", formatos: "PNG, JPEG ou WEBP", accept: "image/png,image/jpeg,image/webp",
  },
  imagem_post: {
    bucket: "comunidade", formatos: "imagem (JPG, PNG, WEBP, GIF, HEIC) ou PDF", accept: ACCEPT.comunidade,
  },
  // Não citado nos 8 pontos da demanda, mas é envio de imagem como qualquer
  // outro (banner promocional da Academy) — incluído para "TODOS os pontos"
  // valer de verdade. Registrado no relatório final.
  banner_academy: {
    bucket: "biblioteca", tamanhoMb: 3, formatos: "PNG ou JPEG", accept: "image/png,image/jpeg",
  },
};

/** O tamanho que de fato se aplica ao campo — o dele, se a tela já tinha um; senão o do bucket. */
export function limiteEfetivoMb(campo: CampoDeImagem): number {
  const cfg = CAMPOS[campo];
  return cfg.tamanhoMb ?? LIMITES[cfg.bucket].tamanhoMb;
}

/** A frase para mostrar ANTES do envio, ex.: "PNG ou JPEG, até 3 MB. Ideal: 1200x600 pixels." */
export function avisoDoCampo(campo: CampoDeImagem): string {
  const cfg = CAMPOS[campo];
  const base = `${cfg.formatos}, até ${limiteEfetivoMb(campo)} MB.`;
  return cfg.pixels ? `${base} Ideal: ${cfg.pixels.largura}x${cfg.pixels.altura} pixels.` : base;
}

/**
 * Checagem no navegador, antes de sequer tentar o envio — é o que permite
 * dizer o tamanho do ARQUIVO ESCOLHIDO, não só o limite (o erro do próprio
 * Storage, traduzido por `erroDeUpload`, não sabe esse número). `null` quando
 * o arquivo passa.
 */
export function erroDeArquivo(arquivo: File, campo: CampoDeImagem): string | null {
  const mb = limiteEfetivoMb(campo);
  if (arquivo.size > mb * 1024 * 1024) {
    const atual = (arquivo.size / (1024 * 1024)).toFixed(1).replace(".", ",");
    return `Este arquivo tem ${atual} MB e o limite é ${mb} MB. Reduza o tamanho e tente de novo.`;
  }
  return null;
}

/**
 * Traduz. Recebe o erro do storage e o bucket, devolve a frase para o toast.
 *
 * Cai no genérico quando não reconhece — melhor uma frase vaga em português do
 * que o texto do provedor em inglês, e o `message` original vai junto para o
 * caso de ser algo que ninguém previu.
 */
export function erroDeUpload(erro: { message?: string } | null, bucket: string): string {
  const limite = LIMITES[bucket];
  const msg = erro?.message ?? "";

  if (/mime type|not supported|InvalidMimeType/i.test(msg)) {
    return limite
      ? `Este formato não é aceito aqui. Envie ${limite.formatos}.`
      : "Este formato de arquivo não é aceito aqui.";
  }
  if (/exceeded the maximum|too large|EntityTooLarge|413/i.test(msg)) {
    return limite
      ? `O arquivo passa de ${limite.tamanhoMb} MB, que é o limite aqui.`
      : "O arquivo é grande demais.";
  }
  if (/duplicate|already exists/i.test(msg)) {
    return "Já existe um arquivo com esse nome. Tente de novo.";
  }
  return `Não consegui enviar o arquivo. (${msg || "erro desconhecido"})`;
}
