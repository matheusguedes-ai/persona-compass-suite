/**
 * "Ver como aluno" — o mentor pré-visualiza a área do aluno, só-leitura.
 *
 * A verdade sobre "o modo está ativo, e para quem" mora em DOIS lugares que se
 * corrigem um ao outro: a URL (`?ver=<personId>`, o jeito de chegar e de
 * compartilhar um link) e o sessionStorage desta aba (o jeito de o modo
 * SOBREVIVER a uma navegação que esqueceu de repassar o parâmetro, ou a um
 * link colado/aberto sem ele — #274). Nenhuma navegação interna apaga o
 * sessionStorage; só `sairDoPreview` (o botão "Voltar ao meu painel").
 *
 * sessionStorage, não localStorage: o modo vale para ESTA aba. Um mentor com
 * duas abas abertas — uma em prévia, outra no próprio painel — não pode ter a
 * segunda contaminada pela primeira.
 */
import { toast } from "sonner";

const CHAVE_PREVIEW = "vca_person_id";

export function lerPreviewSalvo(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return sessionStorage.getItem(CHAVE_PREVIEW) ?? undefined;
}

export function salvarPreview(id: string) {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(CHAVE_PREVIEW) !== id) sessionStorage.setItem(CHAVE_PREVIEW, id);
}

export function sairDoPreview() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CHAVE_PREVIEW);
}

export const MENSAGEM_PREVIEW_BLOQUEADO =
  "Você está no modo visualização. Nada é salvo no lugar do aluno.";

/**
 * A trava do lado da tela: recusa a ação com um aviso educado se `isPreview`;
 * senão, executa normalmente. Um lugar só para o texto e a regra, em vez de um
 * `!!ver` solto (e às vezes esquecido) em cada botão que grava.
 */
export function bloqueadoNoPreview(isPreview: boolean, acao: () => void) {
  if (isPreview) {
    toast.info(MENSAGEM_PREVIEW_BLOQUEADO);
    return;
  }
  acao();
}
