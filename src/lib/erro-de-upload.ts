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
};

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
