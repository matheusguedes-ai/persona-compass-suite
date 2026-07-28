/**
 * Equipe: mentores e colaboradores.
 *
 * São a mesma máquina por baixo (`team_members`), com dois recortes diferentes:
 * - **mentor**: acessa só os grupos que você atribuir, e em cada grupo você
 *   decide se ele pode baixar o relatório ou só ver dentro da plataforma;
 * - **colaborador**: trabalha na conta inteira, limitado pelas permissões de
 *   funcionalidade que você marcar.
 *
 * Quem enxerga o quê é decidido pela RLS do banco (ver a migração
 * `20260728040000_equipe_e_permissoes.sql`). Aqui ficam as regras de quem pode
 * **administrar** a equipe: só o dono da conta.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Permissões de colaborador. Cada uma libera um menu/ação da plataforma. */
export const PERMISSOES = [
  "pessoas",
  "grupos",
  "testes",
  "envios",
  "relatorios",
  "educacao",
  "configuracoes",
] as const;
export type Permissao = (typeof PERMISSOES)[number];

export const PERMISSAO_LABEL: Record<Permissao, { titulo: string; ajuda: string }> = {
  pessoas: { titulo: "Pessoas", ajuda: "Cadastrar e editar avaliados." },
  grupos: { titulo: "Grupos", ajuda: "Criar grupos e gerenciar quem está neles." },
  testes: { titulo: "Testes", ajuda: "Criar e editar inventários." },
  envios: { titulo: "Envios", ajuda: "Disparar testes e gerar links." },
  relatorios: { titulo: "Relatórios", ajuda: "Abrir os relatórios dos avaliados." },
  educacao: { titulo: "Educação", ajuda: "Publicar aulas, trilhas e materiais." },
  configuracoes: { titulo: "Configurações", ajuda: "Mexer na marca e nas preferências da conta." },
};

/**
 * Só o dono administra a equipe. Um convidado — mesmo colaborador com todas as
 * permissões — não convida outras pessoas nem muda o próprio acesso.
 */
async function exigirDono(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc("member_kind");
  if (error) throw new Error(error.message);
  if (data !== "owner") {
    throw new Error("Só o dono da conta pode gerenciar a equipe.");
  }
}

const memberSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200),
  kind: z.enum(["mentor", "colaborador"]),
  permissions: z.array(z.enum(PERMISSOES)).default([]),
  expires_at: z.string().datetime().optional().nullable(),
});

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["mentor", "colaborador"]).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("team_members")
      .select("*, team_member_groups(group_id, can_download_reports, groups(id, name))")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => memberSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirDono(supabase);

    // Mentor não recebe permissões de funcionalidade: o acesso dele vem dos
    // grupos atribuídos. Guardar as duas coisas confundiria a leitura depois.
    const permissions = data.kind === "colaborador" ? data.permissions : [];

    const { data: row, error } = await supabase
      .from("team_members")
      .insert({
        owner_id: userId,
        name: data.name,
        email: data.email.toLowerCase(),
        kind: data.kind,
        permissions,
        invite_expires_at: data.expires_at ?? null,
      })
      .select()
      .single();
    if (error) {
      if (error.message.includes("uq_team_members_owner_email")) {
        throw new Error("Já existe alguém com este email na sua equipe.");
      }
      throw new Error(error.message);
    }
    return row;
  });

export const updateTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(2).max(160).optional(),
      permissions: z.array(z.enum(PERMISSOES)).optional(),
      status: z.enum(["convidado", "ativo", "inativo"]).optional(),
      expires_at: z.string().datetime().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirDono(supabase);
    const { id, expires_at, ...rest } = data;
    const patch = {
      ...rest,
      ...(expires_at !== undefined ? { invite_expires_at: expires_at } : {}),
    };

    const { data: row, error } = await supabase
      .from("team_members")
      .update(patch)
      .eq("id", id)
      .eq("owner_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirDono(supabase);
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Regera o link de convite — útil quando o anterior vazou ou expirou. */
export const resetInviteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirDono(supabase);
    const { data: row, error } = await supabase
      .from("team_members")
      .update({ invite_token: crypto.randomUUID(), status: "convidado", user_id: null, accepted_at: null })
      .eq("id", data.id)
      .eq("owner_id", userId)
      .select("id, invite_token")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Define de uma vez os grupos de um mentor. Troca o conjunto inteiro em vez de
 * ir somando: é o que a tela mostra (uma lista de caixas marcadas) e evita
 * sobrar acesso a um grupo que foi desmarcado.
 */
export const setMemberGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      member_id: z.string().uuid(),
      groups: z.array(z.object({
        group_id: z.string().uuid(),
        can_download_reports: z.boolean().default(false),
      })).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirDono(supabase);

    const { data: member, error: mErr } = await supabase
      .from("team_members")
      .select("id, owner_id")
      .eq("id", data.member_id)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member || member.owner_id !== userId) {
      throw new Error("Membro não encontrado ou não pertence a você.");
    }

    const { error: delErr } = await supabase
      .from("team_member_groups")
      .delete()
      .eq("team_member_id", data.member_id);
    if (delErr) throw new Error(delErr.message);

    if (data.groups.length > 0) {
      const { error: insErr } = await supabase.from("team_member_groups").insert(
        data.groups.map((g) => ({
          team_member_id: data.member_id,
          group_id: g.group_id,
          can_download_reports: g.can_download_reports,
        })),
      );
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true, total: data.groups.length };
  });

/**
 * Quem é o usuário logado dentro da conta em que está agindo.
 *
 * A interface usa isso para decidir quais menus mostrar. **Não é a barreira de
 * segurança** — quem barra de verdade é a RLS do banco; esconder um menu só
 * evita que a pessoa esbarre num erro.
 */
export const getMyMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("team_members")
      .select("id, kind, permissions, owner_id, name, status")
      .eq("user_id", userId)
      .eq("status", "ativo")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!row) {
      return {
        kind: "owner" as const,
        permissions: [...PERMISSOES] as string[],
        account_id: userId,
        member_id: null as string | null,
      };
    }
    return {
      kind: row.kind as "mentor" | "colaborador",
      // Mentor não tem permissões de funcionalidade: ele acessa os grupos dele.
      permissions: row.kind === "colaborador" ? row.permissions : ["relatorios"],
      account_id: row.owner_id,
      member_id: row.id,
    };
  });

/** Aceita o convite. O vínculo é criado pela função do banco. */
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("accept_team_invite", { _token: data.token });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Convite não encontrado.");
    return row;
  });
