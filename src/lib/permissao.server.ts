/**
 * Permissão de colaborador — checada de verdade, não só escondida do menu.
 *
 * Até 31/07/2026, `permissions` só era conferida no menu (`app-sidebar.tsx`)
 * e nas abas (`abas-testes.tsx`). NENHUMA função de servidor perguntava se
 * quem estava pedindo podia estar ali — um colaborador com acesso só a
 * Envios, digitando `/testes` na barra de endereço, via o catálogo inteiro
 * de testes, porque a função que serve a tela nunca checava.
 *
 * RLS não resolve isto: ela garante o ESCOPO DA CONTA (não ver dado de outra
 * conta) e o recorte por GRUPO do mentor — não tem noção nenhuma de
 * "colaborador só de Envios". Essa checagem só existe se alguém escrever.
 *
 * Dono sempre passa. Mentor só tem a permissão fixa `relatorios` (o resto do
 * acesso dele é por GRUPO, não por funcionalidade — ver `membershipDoUsuario`
 * em `team.functions.ts`). Colaborador precisa ter a permissão marcada.
 * Aluno e qualquer sessão sem vínculo são sempre negados.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { membershipDoUsuario, type Permissao } from "@/lib/team.functions";

export async function exigirPermissao(
  supabase: SupabaseClient<Database>,
  userId: string,
  perm: Permissao,
): Promise<void> {
  const m = await membershipDoUsuario(supabase, userId);
  if (m.kind === "owner") return;
  if ((m.permissions as string[]).includes(perm)) return;
  throw new Error("Você não tem acesso a esta área.");
}

/**
 * Como `exigirPermissao`, mas para função compartilhada com o painel do
 * MENTOR (`_app.grupos.$id.tsx`: `DevolutivasPage`, `GroupDashboard`).
 *
 * Testes/Devolutivas nessas telas já chegam recortados pelo próprio RLS — as
 * policies usam `can_see_person()`/`posso_agendar_devolutiva()`, que restringem
 * o MENTOR aos grupos dele (e liberam geral para quem não é mentor). Então
 * aqui o mentor sempre passa: pedir sem filtro, ou com o id de outro grupo,
 * simplesmente não traz nada — o banco já resolve. Só o colaborador precisa
 * da permissão marcada, porque para ele essas policies não recortam nada
 * (`member_kind() <> 'mentor'` libera geral).
 */
export async function exigirPermissaoOuMentor(
  supabase: SupabaseClient<Database>,
  userId: string,
  perm: Permissao,
): Promise<void> {
  const m = await membershipDoUsuario(supabase, userId);
  if (m.kind === "owner" || m.kind === "mentor") return;
  if (m.kind === "colaborador" && m.permissions.includes(perm)) return;
  throw new Error("Você não tem acesso a esta área.");
}

/**
 * Acesso a UM grupo — para telas que o mentor também visita.
 *
 * `/grupos/$id` serve dois públicos: o dono/colaborador (gestão da conta) E o
 * mentor vendo o grupo que ele acompanha (`aluno.grupos.tsx` linka pra lá).
 * `exigirPermissao("grupos")` sozinha bloquearia o mentor — ele nunca tem
 * permissão de funcionalidade, só grupo atribuído. Esta função cobre os três
 * casos: dono sempre; colaborador com a permissão 'grupos'; mentor SE este
 * grupo específico está entre os que ele acompanha (`team_member_groups`).
 */
export async function exigirAcessoAoGrupo(
  supabase: SupabaseClient<Database>,
  userId: string,
  groupId: string,
): Promise<void> {
  const m = await membershipDoUsuario(supabase, userId);
  if (m.kind === "owner") return;
  if (m.kind === "colaborador" && m.permissions.includes("grupos")) return;
  if (m.kind === "mentor" && m.groups.some((g) => g.group_id === groupId)) return;
  throw new Error("Você não tem acesso a esta área.");
}
