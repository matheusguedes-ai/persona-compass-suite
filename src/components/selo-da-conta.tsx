/**
 * O selo nas telas de quem está logado.
 *
 * Lê a marca do contexto — que já é carregada uma vez por sessão —, então não
 * custa uma consulta a mais por página.
 */
import { useBrand } from "@/lib/brand";
import { SeloEmpresa } from "@/components/selo-empresa";

export function SeloDaConta() {
  const brand = useBrand();
  return <SeloEmpresa nome={brand?.company_name} cnpj={brand?.company_cnpj} />;
}
