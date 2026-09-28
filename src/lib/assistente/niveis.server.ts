/**
 * #317 — o lado do servidor dos níveis da assistente: o TETO de quem está logado e a ESCOLHA lembrada.
 *
 * Tudo com o login de quem pergunta. O teto do aluno vem de `assistente_categorias()` (a soma das
 * liberações do login e dos grupos dele — as MESMAS linhas que `assistente_liberada()` olha). O mentor
 * não tem teto: as três. A escolha lembrada (`assistente_preferencias`) é lida pela RLS
 * `user_id = auth.uid()` e nunca vale sozinha — passa sempre por `nivelEmUso` contra o teto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  CATEGORIAS,
  naOrdem,
  nivelEmUso,
  type Categoria,
  type NiveisDaTela,
} from "@/lib/assistente/niveis";

type Cliente = SupabaseClient<Database>;

export type EscopoDoNivel = "aluno" | "mentor";

export async function tetoDoLogin(supabase: Cliente, escopo: EscopoDoNivel): Promise<Categoria[]> {
  if (escopo === "mentor") return [...CATEGORIAS];
  const { data, error } = await supabase.rpc("assistente_categorias");
  if (error) throw new Error(`Não foi possível consultar os níveis liberados (${error.message}).`);
  return naOrdem(data ?? []);
}

export async function escolhaLembrada(
  supabase: Cliente,
  userId: string,
  escopo: EscopoDoNivel,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("assistente_preferencias")
    .select("categoria")
    .eq("user_id", userId)
    .eq("escopo", escopo)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível ler o nível escolhido (${error.message}).`);
  return data?.categoria ?? null;
}

/** `teto` já lido (ex.: veio junto de `assistente_situacao`) evita perguntar ao banco duas vezes. */
export async function niveisDaTela(
  supabase: Cliente,
  userId: string,
  escopo: EscopoDoNivel,
  teto?: readonly unknown[],
): Promise<NiveisDaTela> {
  const permitidas = teto ? naOrdem(teto) : await tetoDoLogin(supabase, escopo);
  return {
    permitidas,
    atual: nivelEmUso(permitidas, await escolhaLembrada(supabase, userId, escopo)),
  };
}
