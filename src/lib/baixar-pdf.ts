/**
 * O clique do "Baixar PDF" (#293, fatia 1).
 *
 * Não é mais `window.print()`. O arquivo vem pronto do servidor, igual para todo mundo; aqui só
 * pedimos e salvamos.
 *
 * O pedido passa por `fetchComSessao` de propósito: é ele que manda o `Authorization` da sessão,
 * e é por esse cabeçalho que o servidor sabe quem está pedindo. Um `<a href>` simples não mandaria
 * nada, e um mentor convidado sem permissão de download receberia o arquivo assim mesmo.
 */
import { toast } from "sonner";
import { fetchComSessao } from "@/lib/fetch-com-sessao";

/** Tira do cabeçalho `Content-Disposition` o nome que o servidor escolheu para o arquivo. */
function nomeDoCabecalho(valor: string | null): string | null {
  if (!valor) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(valor);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      // Cabeçalho malformado: cai no nome ASCII abaixo.
    }
  }
  const simples = /filename="([^"]+)"/i.exec(valor);
  return simples ? simples[1] : null;
}

export async function baixarPdf(url: string, nomeReserva: string): Promise<void> {
  let blobUrl = "";
  try {
    const r = await fetchComSessao(url);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}) as { error?: string });
      toast.error(j.error ?? "Não foi possível gerar o PDF. Tente de novo em instantes.");
      return;
    }
    const blob = await r.blob();
    blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = nomeDoCabecalho(r.headers.get("content-disposition")) ?? `${nomeReserva}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    toast.error("Falha de conexão ao gerar o PDF. Tente de novo.");
  } finally {
    // Só depois do clique: revogar antes cancelaria o download em alguns navegadores.
    if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  }
}
