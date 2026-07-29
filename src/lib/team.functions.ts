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
  "devolutivas",
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
  devolutivas: { titulo: "Devolutivas", ajuda: "Agendar e registrar as conversas de resultado." },
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
      .select("*, team_member_groups(group_id, can_download_reports, can_schedule_devolutivas, groups(id, name))")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const lista = rows ?? [];

    // A foto de quem já aceitou o convite mora em `profiles` (é a foto da conta
    // dela, que ela mesma escolhe em Configurações).
    const ids = lista.map((m) => m.user_id).filter((id): id is string => !!id);
    if (ids.length === 0) return lista.map((m) => ({ ...m, avatar_url: null as string | null }));

    const { data: perfis } = await supabase
      .from("profiles").select("user_id, avatar_url").in("user_id", ids);
    const porUsuario = new Map((perfis ?? []).map((p) => [p.user_id, p.avatar_url]));
    return lista.map((m) => ({
      ...m,
      avatar_url: m.user_id ? porUsuario.get(m.user_id) ?? null : null,
    }));
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
    // O convite existia mas nunca saía do banco: o token era gerado e ninguém
    // avisava a pessoa. Era isso que fazia "adicionar mentor" parecer quebrado.
    await mandarConvite(supabase, userId, row.id);
    return row;
  });

/**
 * Manda o convite para o e-mail do membro.
 *
 * Silencioso de propósito: se o envio falhar, o convite continua válido e o
 * dono pode reenviar. Derrubar a criação por causa do e-mail deixaria o dono
 * sem entender o que aconteceu — e o link, que é o que importa, já existe.
 */
async function mandarConvite(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  memberId: string,
): Promise<void> {
  try {
    const { data: m } = await supabase
      .from("team_members")
      .select("name, email, kind, invite_token")
      .eq("id", memberId)
      .maybeSingle();
    if (!m?.invite_token || !m.email) return;

    const { data: perfil } = await supabase
      .from("profiles")
      .select("company_name, brand_color, site_url, support_email, email_from")
      .eq("user_id", ownerId)
      .maybeSingle();

    const { enviarEmail, montarHtml } = await import("@/lib/email.server");
    const site = process.env.SITE_URL || "https://persona-compass-suite.lovable.app";
    const marca = perfil?.company_name?.trim() || "Métrica Humana";
    const papel = m.kind === "mentor" ? "mentor" : "colaborador";
    const primeiro = (m.name ?? "").split(" ")[0] || "Olá";

    await enviarEmail({
      to: m.email,
      subject: `Convite para ${papel} em ${marca}`,
      html: montarHtml({
        corpo:
          `${primeiro}, você foi convidado para atuar como ${papel} em ${marca}.\n\n` +
          "Clique no botão abaixo para aceitar o convite. Na primeira vez você vai escolher uma " +
          "senha; depois disso, é só entrar com o seu e-mail e essa senha.\n\n" +
          "Se você não esperava este convite, pode ignorar esta mensagem.",
        link: `${site}/convite-equipe/${m.invite_token}`,
        rotuloBotao: "Aceitar o convite",
        marca: perfil ?? null,
      }),
      from: perfil?.email_from ?? null,
      replyTo: perfil?.support_email ?? null,
    });
  } catch {
    // Ver o comentário acima: o convite vale mesmo sem o e-mail ter saído.
  }
}

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
    // Reenviar também manda o e-mail: era o botão que não fazia nada visível.
    await mandarConvite(supabase, userId, data.id);
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
        can_schedule_devolutivas: z.boolean().default(false),
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
      // Não é da equipe. Pode ser o dono da conta ou um avaliado que criou
      // login: o que separa os dois é ter cadastro próprio (`user_id`) sem ter
      // avaliados sob a sua gestão (`mentor_id`).
      const [souAvaliado, tenhoAvaliados] = await Promise.all([
        supabase.from("people").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("people").select("id", { count: "exact", head: true }).eq("mentor_id", userId),
      ]);
      const ehAluno = (souAvaliado.count ?? 0) > 0 && (tenhoAvaliados.count ?? 0) === 0;
      return {
        kind: (ehAluno ? "aluno" : "owner") as "owner" | "aluno",
        permissions: ehAluno ? [] : ([...PERMISSOES] as string[]),
        account_id: userId,
        member_id: null as string | null,
      };
    }
    return {
      kind: row.kind as "mentor" | "colaborador" | "owner" | "aluno",
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

/**
 * Este usuário pode baixar o relatório desta resposta?
 *
 * Só faz sentido para quem está logado na plataforma. Dono e colaborador sempre
 * podem; mentor depende do `can_download_reports` do grupo pelo qual ele
 * enxerga aquele avaliado — se enxerga por mais de um grupo, basta um permitir.
 */
export const canDownloadReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ response_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: kind, error: kErr } = await supabase.rpc("member_kind");
    if (kErr) throw new Error(kErr.message);
    if (kind !== "mentor") return { allowed: true };

    const { data: resp, error: rErr } = await supabase
      .from("test_responses")
      .select("person_id")
      .eq("id", data.response_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    // Não enxerga a resposta (a RLS já filtrou): nada a liberar.
    if (!resp) return { allowed: false };

    const { data: membro, error: mErr } = await supabase
      .from("team_members")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "ativo")
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!membro) return { allowed: false };

    const [{ data: gruposDaPessoa }, { data: gruposDoMentor }] = await Promise.all([
      supabase.from("group_members").select("group_id").eq("person_id", resp.person_id),
      supabase.from("team_member_groups").select("group_id, can_download_reports").eq("team_member_id", membro.id),
    ]);

    const daPessoa = new Set((gruposDaPessoa ?? []).map((g) => g.group_id));
    const allowed = (gruposDoMentor ?? []).some((g) => daPessoa.has(g.group_id) && g.can_download_reports);
    return { allowed };
  });

/**
 * Dados do convite, para a tela mostrar de quem ele é antes de pedir a senha.
 *
 * Público, identificado pelo token — que é o próprio link recebido por e-mail.
 * Devolve o mínimo: nome, papel e o e-mail, que a pessoa precisa reconhecer
 * para saber com qual endereço vai entrar depois.
 */
export const dadosDoConvite = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin
      .from("team_members")
      .select("name, email, kind, status, invite_expires_at, owner_id")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!m) return { valido: false as const, motivo: "Convite não encontrado." };
    if (m.status === "ativo") return { valido: false as const, motivo: "Este convite já foi aceito." };
    if (m.invite_expires_at && new Date(m.invite_expires_at) < new Date()) {
      return { valido: false as const, motivo: "Este convite expirou. Peça um novo ao seu mentor." };
    }
    const { data: perfil } = await supabaseAdmin
      .from("profiles").select("company_name").eq("user_id", m.owner_id).maybeSingle();
    return {
      valido: true as const,
      nome: m.name,
      email: m.email,
      papel: m.kind === "mentor" ? "mentor" : "colaborador",
      empresa: perfil?.company_name?.trim() || "Métrica Humana",
    };
  });

/**
 * Cria a conta de quem chegou pelo convite, com a senha que ele escolheu.
 *
 * Por que aqui a senha pode ser escolhida direto, diferente do primeiro acesso
 * do aluno: o TOKEN já é a prova de que o e-mail é da pessoa — ele só existe no
 * link que foi enviado para aquele endereço. É a mesma lógica de um link de
 * redefinir senha. Mandar outro e-mail para confirmar o que o primeiro já
 * confirmou seria só um passo a mais, sem ganho.
 *
 * O e-mail NÃO vem do formulário: vem do convite. Assim o token não pode ser
 * usado para criar conta em nome de outro endereço.
 */
export const criarContaDoConvite = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: z.string().uuid(), senha: z.string().min(8).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin
      .from("team_members")
      .select("email, status, invite_expires_at")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!m?.email) throw new Error("Convite não encontrado.");
    if (m.status === "ativo") throw new Error("Este convite já foi aceito.");
    if (m.invite_expires_at && new Date(m.invite_expires_at) < new Date()) {
      throw new Error("Este convite expirou. Peça um novo ao seu mentor.");
    }

    // `email_confirm: true` porque o token já provou o endereço — a pessoa só
    // chegou aqui porque abriu o e-mail que o continha.
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: m.email,
      password: data.senha,
      email_confirm: true,
    });
    if (error && !/already|registered|exists/i.test(error.message)) {
      throw new Error(error.message);
    }
    // Já existia: o convite não serve para trocar a senha de uma conta alheia.
    return { ok: true as const, email: m.email, jaExistia: !!error };
  });
