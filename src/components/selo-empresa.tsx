/**
 * O selo de quem opera a plataforma.
 *
 * Aparece em TODAS as telas — internas e públicas —, por decisão do Matheus:
 * é identificação, não configuração. Por isso não há chave para ligar e
 * desligar; um selo que às vezes some não identifica nada.
 *
 * Só nome e CNPJ. Endereço ficou de fora a pedido dele, e é bom que tenha
 * ficado: as páginas de teste e de relatório abrem por link, sem login, e
 * endereço ali circularia com o link. CNPJ é registro público — nome e CNPJ
 * dizem de quem é o sistema sem expor onde alguém trabalha.
 */
export function SeloEmpresa({
  nome,
  cnpj,
  className = "",
}: {
  nome?: string | null;
  cnpj?: string | null;
  className?: string;
}) {
  // Sem nada cadastrado, não desenha uma linha vazia.
  if (!nome && !cnpj) return null;

  return (
    <footer
      className={`border-t border-black/5 px-6 py-4 text-center text-xs text-muted-foreground ${className}`}
    >
      <p>
        {nome}
        {nome && cnpj && " · "}
        {cnpj && <span className="tabular-nums">CNPJ {cnpj}</span>}
      </p>
    </footer>
  );
}
