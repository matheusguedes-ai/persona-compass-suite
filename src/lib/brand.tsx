import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccountBrand } from "@/lib/data.functions";
import { cssDaMarca } from "@/lib/cores-da-marca";

/**
 * Marca do mentor aplicada na interface.
 *
 * Aparece em dois contextos diferentes:
 * - **logado**: a marca é a da CONTA — `acting_account()` —, nunca a do
 *   perfil de quem está logado (`BrandProvider`, via `getAccountBrand`). O
 *   master muda, muda para dono, colaborador, mentor convidado e aluno juntos.
 * - **página pública** (convite, teste, relatório): a marca é a do mentor DONO
 *   do link — quem abre não tem conta. Nesses casos o servidor manda a marca
 *   junto com os dados e a tela chama `useApplyBrand`.
 */
export type Brand = {
  company_name?: string | null;
  company_cnpj?: string | null;
  company_seal_name?: string | null;
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

const ID_DA_FOLHA = "marca-da-conta";

/**
 * Sobrescreve os tokens de cor do tema com os da marca. Só mexe no que o
 * mentor definiu — campo vazio mantém o tema padrão em vez de zerar a cor.
 *
 * #285B — vira uma folha de estilo com uma regra para cada tema, em vez de
 * `style` no `<html>` (que valia igual no claro e no escuro: a cor secundária
 * preta da conta do dono pintava links de preto sobre o fundo escuro). O que
 * cada tema recebe, e por quê, está em `cores-da-marca.ts`.
 */
export function applyBrand(b: Brand | null | undefined) {
  if (typeof document === "undefined") return;
  const css = b ? cssDaMarca(b.brand_color, b.brand_accent_color) : "";
  let folha = document.getElementById(ID_DA_FOLHA) as HTMLStyleElement | null;
  if (!css) {
    folha?.remove();
    return;
  }
  if (!folha) {
    folha = document.createElement("style");
    folha.id = ID_DA_FOLHA;
    document.head.appendChild(folha);
  }
  folha.textContent = css;
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
  const getFn = useServerFn(getAccountBrand);
  const { data } = useQuery({
    queryKey: ["account-brand"],
    queryFn: () => getFn(),
    staleTime: 60_000,
  });

  const brand = useMemo<Brand | null>(() => data?.brand ?? null, [data]);

  useApplyBrand(brand);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand(): Brand | null {
  return useContext(BrandContext);
}

// ============================================================
// Marca para telas SEM sessão (#261) — login hoje, #262 espalha
// ============================================================
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
 * Busca `/api/marca` (resolvida pelo HOST, não por login — ver
 * loadPublicLoginBrand em brand.server.ts). `undefined` enquanto carrega,
 * distinto de `null` (resolvido, mas sem nada configurado) — quem chama usa
 * essa distinção para não piscar a marca padrão antes da real: melhor um
 * instante de vazio (ver docs/plano-marca-publica.md).
 *
 * `fetch` simples, não `useServerFn`/react-query — mesmo padrão já usado nas
 * outras telas sem sessão (`ResponseForm`, a página de convite).
 */
export function usePublicBrand(): PublicLoginBrand | null | undefined {
  const [brand, setBrand] = useState<PublicLoginBrand | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/marca")
      .then((r) => r.json())
      .then((j) => { if (!cancelado) setBrand((j?.brand ?? null) as PublicLoginBrand | null); })
      .catch(() => { if (!cancelado) setBrand(null); });
    return () => { cancelado = true; };
  }, []);

  return brand;
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
