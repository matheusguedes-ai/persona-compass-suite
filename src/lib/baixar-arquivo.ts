/** Dispara o download de um Blob já montado no navegador (planilha, CSV…).
 * Extraído do #280 (era local a `_app.respostas.index.tsx`) para o #301
 * reaproveitar sem copiar — PDF autenticado usa `baixarPdf`, não este. */
export function baixarArquivo(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
