/**
 * Marca e preferências do mentor para as páginas públicas.
 *
 * Quem abre um convite, um teste ou um relatório não tem conta — então a marca
 * que vale é a do mentor DONO daquele link, buscada aqui pelo servidor. Devolve
 * só o que é para ser visto de fora: nada de email do mentor, id ou dados de
 * outros avaliados.
 */

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type PublicBrand = {
  company_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  brand_accent_color: string | null;
  site_url: string | null;
  support_email: string | null;
};

export type ReportSettings = {
  allow_pdf: boolean;
  show_brand: boolean;
  hidden_blocks: string[];
};

export const PADRAO_SETTINGS: ReportSettings = {
  allow_pdf: true,
  show_brand: true,
  hidden_blocks: [],
};

/**
 * Mentor sem perfil salvo é o caso normal de quem nunca abriu Configurações:
 * devolve marca nula (a tela cai no padrão da plataforma) e preferências
 * permissivas — esconder blocos precisa ser uma escolha explícita.
 */
export async function loadBrandAndSettings(
  mentorId: string | null | undefined,
): Promise<{ brand: PublicBrand | null; settings: ReportSettings }> {
  if (!mentorId) return { brand: null, settings: PADRAO_SETTINGS };

  const supabase = await getAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "company_name, company_cnpj, company_seal_name, logo_url, brand_color, brand_accent_color, site_url, support_email, report_allow_pdf, report_show_brand, report_hidden_blocks",
    )
    .eq("user_id", mentorId)
    .maybeSingle();

  // Falha aqui não pode derrubar o relatório: sem marca ele ainda é legível.
  if (error || !data) return { brand: null, settings: PADRAO_SETTINGS };

  const settings: ReportSettings = {
    allow_pdf: data.report_allow_pdf ?? true,
    show_brand: data.report_show_brand ?? true,
    hidden_blocks: data.report_hidden_blocks ?? [],
  };

  // Marca desligada nas configurações não deve vazar para a página pública.
  if (!settings.show_brand) return { brand: null, settings };

  const { assinarUrl, TTL_MARCA_SEGUNDOS } = await import("@/lib/storage-assinado.server");
  const logoAssinado = await assinarUrl(supabase, data.logo_url, TTL_MARCA_SEGUNDOS);

  return {
    brand: {
      company_name: data.company_name,
      logo_url: logoAssinado,
      brand_color: data.brand_color,
      brand_accent_color: data.brand_accent_color,
      site_url: data.site_url,
      support_email: data.support_email,
    },
    settings,
  };
}

/**
 * Resolve "a conta" para pedidos SEM SESSÃO — o manifest.json e os ícones do
 * app (#235) são buscados pelo navegador/celular às vezes sem cookie nenhum,
 * na hora de instalar, então não há `userId` para saber de quem é a marca.
 *
 * ⚠️ Funciona HOJE só porque existe UM único cliente na plataforma: pega
 * sempre o `profiles` mais antigo (`created_at` menor), configurado ou não —
 * não depende de qual campo está preenchido, então não muda de dono se um dia
 * outra conta configurar a marca dela primeiro.
 *
 * QUANDO HOUVER O SEGUNDO CLIENTE, isto passa a devolver a marca ERRADA para
 * metade das contas — não há, hoje, nenhuma informação na requisição (domínio
 * próprio, subdomínio, path com id) que diga qual conta o navegador quer.
 * Antes de vender a plataforma para o segundo cliente, troque esta função por
 * resolução real (subdomínio por conta, domínio próprio, ou id explícito na
 * própria URL do manifest/ícone).
 */
export async function resolveContaUnica(): Promise<{
  user_id: string;
  icon_url: string | null;
  company_name: string | null;
  brand_color: string | null;
} | null> {
  const supabase = await getAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, icon_url, company_name, brand_color")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
