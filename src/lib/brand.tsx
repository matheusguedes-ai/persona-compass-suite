import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/data.functions";

/**
 * Marca do mentor aplicada na interface.
 *
 * Aparece em dois contextos diferentes:
 * - **logado**: a marca é a do próprio usuário (`BrandProvider`);
 * - **página pública** (convite, teste, relatório): a marca é a do mentor DONO
 *   do link — quem abre não tem conta. Nesses casos o servidor manda a marca
 *   junto com os dados e a tela chama `useApplyBrand`.
 */
export type Brand = {
  company_name?: string | null;
  company_cnpj?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
  brand_accent_color?: string | null;
  site_url?: string | null;
  support_email?: string | null;
};

export const MARCA_PADRAO = "Métrica Humana";

/** Nome exibido: o do mentor quando houver, senão o da plataforma. */
export function brandName(b: Brand | null | undefined) {
  return b?.company_name?.trim() || MARCA_PADRAO;
}

/**
 * Preto ou branco por cima da cor escolhida, pelo brilho percebido. Sem isso
 * um mentor que escolhe amarelo fica com texto branco ilegível no botão.
 */
function textoLegivelSobre(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#111111" : "#ffffff";
}

const CHAVES = [
  "--primary", "--primary-foreground",
  "--sidebar-primary", "--sidebar-primary-foreground",
  "--accent", "--accent-foreground",
] as const;

/**
 * Sobrescreve os tokens de cor no `<html>`. Só mexe no que o mentor definiu —
 * campo vazio mantém o tema padrão em vez de zerar a cor.
 */
export function applyBrand(b: Brand | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const k of CHAVES) root.style.removeProperty(k);
  if (!b) return;

  const primary = b.brand_color?.trim();
  if (primary) {
    const fg = textoLegivelSobre(primary);
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-foreground", fg);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-primary-foreground", fg);
  }
  const accent = b.brand_accent_color?.trim();
  if (accent) {
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-foreground", textoLegivelSobre(accent));
  }
}

/** Aplica a marca enquanto a tela estiver montada e devolve o tema ao sair. */
export function useApplyBrand(b: Brand | null | undefined) {
  const chave = JSON.stringify([b?.brand_color ?? null, b?.brand_accent_color ?? null]);
  useEffect(() => {
    applyBrand(b);
    return () => applyBrand(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
}

// ============================================================
// Contexto para as telas de quem está logado
// ============================================================
const BrandContext = createContext<Brand | null>(null);

export function BrandProvider({ children }: { children: ReactNode }) {
  const getFn = useServerFn(getMyProfile);
  const { data } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getFn(),
    staleTime: 60_000,
  });

  const brand = useMemo<Brand | null>(() => {
    const p = data?.profile;
    if (!p) return null;
    return {
      company_name: p.company_name,
      company_cnpj: p.company_cnpj,
      logo_url: p.logo_url,
      brand_color: p.brand_color,
      brand_accent_color: p.brand_accent_color,
      site_url: p.site_url,
      support_email: p.support_email,
    };
  }, [data]);

  useApplyBrand(brand);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand(): Brand | null {
  return useContext(BrandContext);
}

/**
 * Logo + nome. Sem logo, cai num quadrado com a inicial — melhor do que um
 * espaço vazio enquanto o mentor não subiu imagem.
 */
export function BrandMark({
  brand,
  className = "",
  textClass = "text-sm font-semibold uppercase tracking-tight",
  size = 24,
}: {
  brand?: Brand | null;
  className?: string;
  textClass?: string;
  size?: number;
}) {
  const nome = brandName(brand);
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      {brand?.logo_url ? (
        <img
          src={brand.logo_url}
          alt={nome}
          style={{ height: size, maxWidth: size * 4 }}
          className="rounded object-contain"
        />
      ) : (
        <span
          className="grid shrink-0 place-items-center rounded bg-primary text-primary-foreground"
          style={{ width: size, height: size, fontSize: size * 0.5 }}
        >
          {nome.charAt(0).toUpperCase()}
        </span>
      )}
      <span className={textClass}>{nome}</span>
    </span>
  );
}
