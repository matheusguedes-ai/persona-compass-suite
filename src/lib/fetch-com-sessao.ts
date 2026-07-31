import { supabase } from "@/integrations/supabase/client";

/**
 * `fetch()` para um endpoint `/api/public/*`, com o token da sessão atual
 * anexado QUANDO existe uma.
 *
 * Essas rotas são públicas de propósito — o UUID na URL é o próprio token de
 * acesso, para quem abre o link sem nunca ter criado conta. Isso não muda
 * aqui. O que muda é que, quando quem está do outro lado ESTÁ logado (um
 * mentor abrindo o relatório pela tela, não um avaliado clicando o link do
 * e-mail), o servidor precisa saber disso para aplicar a mesma fronteira de
 * grupo que vale no resto da plataforma — e sem o header, ele não tem como.
 *
 * Sem sessão: `Authorization` nem é anexado, e o comportamento é o de sempre.
 */
export async function fetchComSessao(url: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return fetch(url, init);
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}
