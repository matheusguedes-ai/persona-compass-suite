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

/**
 * O host que o navegador pediu, para resolveContaPorHost/loadPublicLoginBrand
 * (#261). Prefere `x-forwarded-host` — é o que o proxy (Cloudflare, na
 * hospedagem do Lovable) preenche com o host ORIGINAL quando repassa o
 * pedido; o header `host` cru pode virar o do proxy no meio do caminho.
 */
export function hostDaRequisicao(request: Request): string {
  return request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
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
 * Resolve o OWNER pelo HOST da requisição (#261) — substitui a antiga
 * `resolveContaUnica`, que só funcionava com um cliente só na plataforma (o
 * próprio comentário dela já avisava: "antes de vender para o segundo
 * cliente, troque por resolução real").
 *
 * `dominios_conta` nasce com uma linha (o domínio de produção → o Matheus,
 * `padrao=true`). Host que não bate com nenhuma linha — preview do Lovable,
 * `localhost` em desenvolvimento, domínio novo ainda sem cadastro — cai na
 * linha `padrao`. Sem esse fallback, a tela de login (e o manifest/ícone do
 * app, que reaproveitam isto) ficaria sem marca nenhuma no dia em que o
 * Lovable mudar a URL de preview.
 */
async function resolverOwnerPorHost(host: string): Promise<string | null> {
  const supabase = await getAdmin();
  const limpo = host.split(":")[0]?.trim().toLowerCase();

  if (limpo) {
    const { data } = await supabase
      .from("dominios_conta")
      .select("owner_id")
      .eq("dominio", limpo)
      .maybeSingle();
    if (data?.owner_id) return data.owner_id;
  }

  const { data: padrao } = await supabase
    .from("dominios_conta")
    .select("owner_id")
    .eq("padrao", true)
    .maybeSingle();
  return padrao?.owner_id ?? null;
}

/**
 * A conta (ícone + nome + cor) para pedidos SEM SESSÃO — usada pelo manifest
 * e pelos ícones do app (#235), que o navegador/celular busca às vezes sem
 * cookie nenhum, na hora de instalar.
 */
export async function resolveContaPorHost(host: string): Promise<{
  user_id: string;
  icon_url: string | null;
  company_name: string | null;
  brand_color: string | null;
} | null> {
  const ownerId = await resolverOwnerPorHost(host);
  if (!ownerId) return null;
  const supabase = await getAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, icon_url, company_name, brand_color")
    .eq("user_id", ownerId)
    .maybeSingle();
  return data ?? null;
}

export type PublicLoginBrand = {
  company_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  brand_accent_color: string | null;
  login_imagem_url: string | null;
  login_frase: string | null;
  login_rodape: string | null;
};

/**
 * A marca da tela de login e das demais telas sem sessão (#261) — pedido
 * PÚBLICO, sem autenticação nenhuma, então lista FECHADA de campos.
 *
 * ⚠️ `profiles` guarda `company_cnpj`, `support_email`, `email_from`,
 * `site_url`, `report_hidden_blocks`. Nunca `select("*")` aqui: um endpoint
 * aberto que devolvesse a linha inteira entregaria o CNPJ e os e-mails
 * internos para qualquer um que abrisse a tela de login. Ver
 * docs/plano-marca-publica.md.
 */
export async function loadPublicLoginBrand(host: string): Promise<PublicLoginBrand | null> {
  const ownerId = await resolverOwnerPorHost(host);
  if (!ownerId) return null;

  const supabase = await getAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("company_name, logo_url, brand_color, brand_accent_color, login_imagem_url, login_frase, login_rodape")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!data) return null;

  const { assinarUrl, TTL_MARCA_SEGUNDOS } = await import("@/lib/storage-assinado.server");
  const [logo, imagemLateral] = await Promise.all([
    assinarUrl(supabase, data.logo_url, TTL_MARCA_SEGUNDOS),
    assinarUrl(supabase, data.login_imagem_url, TTL_MARCA_SEGUNDOS),
  ]);

  return {
    company_name: data.company_name,
    logo_url: logo,
    brand_color: data.brand_color,
    brand_accent_color: data.brand_accent_color,
    login_imagem_url: imagemLateral,
    login_frase: data.login_frase,
    login_rodape: data.login_rodape,
  };
}
