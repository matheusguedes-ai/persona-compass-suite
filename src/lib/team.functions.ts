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
import { siteUrl } from "@/lib/site-url.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Permissões de colaborador. Cada uma libera um menu/ação da plataforma.
 *
 * 'configuracoes' NÃO está aqui de propósito (Fecha #218): a tela mexe em
 * marca, logo, nome da empresa, mensagens-padrão e remetente — reconfigura a
 * plataforma para todo mundo, não é uma ação de funcionalidade como as
 * demais. Só o dono alcança isso, sempre — não é permissão que se marca.
 */
export const PERMISSOES = [
  "pessoas",
  "grupos",
  "testes",
  "envios",
  "relatorios",
  "mentorias",
  "educacao",
] as const;
export type Permissao = (typeof PERMISSOES)[number];

export const PERMISSAO_LABEL: Record<Permissao, { titulo: string; ajuda: string }> = {
  pessoas: { titulo: "Pessoas", ajuda: "Cadastrar e editar avaliados." },
  grupos: { titulo: "Grupos", ajuda: "Criar grupos e gerenciar quem está neles." },
  testes: { titulo: "Testes", ajuda: "Criar e editar inventários." },
  envios: { titulo: "Envios", ajuda: "Disparar testes e gerar links." },
  relatorios: { titulo: "Relatórios", ajuda: "Abrir os relatórios dos avaliados." },
  mentorias: { titulo: "Mentorias", ajuda: "Criar pacotes, agendar sessões e escrever o resumo." },
  educacao: { titulo: "Educação", ajuda: "Publicar aulas, trilhas e materiais." },
};

/**
 * Só o dono administra a equipe. Um convidado — mesmo colaborador com todas as
 * permissões — não convida outras pessoas nem muda o próprio acesso.
 *
 * Exportada: o Classroom (`classroom.functions.ts`) é "menu do master" pela
 * mesma regra — nenhum colaborador ou mentor administra treinamentos, só quem
 * é dono. Reaproveitar em vez de escrever a checagem de novo.
 */
export async function exigirDono(supabase: SupabaseClient<Database>) {
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
      .select("*, team_member_groups(group_id, can_download_reports, can_schedule_mentorias, groups(id, name))")
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
    const comAvatar = lista.map((m) => ({
      ...m,
      avatar_url: m.user_id ? porUsuario.get(m.user_id) ?? null : null,
    }));

    const { assinarUrls, TTL_AVATAR_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const avatares = await assinarUrls(supabaseAdmin, comAvatar.map((m) => m.avatar_url), TTL_AVATAR_SEGUNDOS);
    return comAvatar.map((m, i) => ({ ...m, avatar_url: avatares[i] }));
  });

export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => memberSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirDono(supabase);

    // Mentor não nasce mais por aqui — nasce promovido na ficha da pessoa
    // (`promoverAMentor`), que reaproveita a linha de team_members quando já
    // existe e amarra o `person_id`. Esta função criava um `team_members`
    // SEM `person_id`: um cadastro solto, sem ficha, sem grupos como
    // avaliado, sem histórico — o problema que a rota `/mentores` (agora
    // redirect) causava. O caminho ainda aceitava `kind: "mentor"` porque
    // ninguém tinha voltado para fechar depois de tirar a tela.
    if (data.kind === "mentor") {
      throw new Error(
        "Mentor não se convida por aqui. Promova a pessoa a mentor na ficha dela, em Pessoas.",
      );
    }

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
    const site = siteUrl();
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
        can_schedule_mentorias: z.boolean().default(false),
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
          // Achado no caminho do #213: o schema já aceitava este campo, mas o
          // insert nunca gravava — o toggle "pode agendar" na tela de Equipe
          // não fazia nada. Ver Fecha #213.
          can_schedule_mentorias: g.can_schedule_mentorias,
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
/**
 * O papel de quem está pedindo, e o que ele pode.
 *
 * Extraída de `getMyMembership` para ser chamada também por
 * `exigirPermissao` (`@/lib/permissao.server`) — a checagem de permissão de
 * colaborador precisa exatamente desta mesma resposta, e duplicar a consulta
 * seria duas fontes de verdade para "quem é essa pessoa".
 */
export async function membershipDoUsuario(supabase: SupabaseClient<Database>, userId: string) {
  // `.order(...).limit(1)` e NÃO `.maybeSingle()`. Quem aceitou convite de
  // duas contas tem duas linhas ativas aqui, e `maybeSingle` responde 406 —
  // a pessoa não entraria em lugar nenhum, com erro que não explica nada.
  // A mais antiga vence, para o painel não trocar de conta entre dois
  // carregamentos. Atender a duas contas ao mesmo tempo é outro problema,
  // que precisa de um seletor de conta e não de um desempate silencioso.
  const { data: rows, error } = await supabase
    .from("team_members")
    .select("id, kind, permissions, owner_id, name, status, created_at, team_member_groups(group_id, can_download_reports, can_schedule_mentorias, groups(name))")
    .eq("user_id", userId)
    .eq("status", "ativo")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (rows ?? [])[0];

  // Esta pessoa também é AVALIADA em alguma conta? As duas coisas convivem: o
  // mentor que faz o próprio DISC com um colega, o colaborador que participa
  // de um treinamento da casa. O código tratava os papéis como excludentes
  // (`ehAluno` exigia NÃO ter avaliados), então quem tinha conta própria
  // nunca chegava à área de aluno — a rota respondia, mas nenhum link levava
  // até ela. Isto é o que acende o atalho.
  const { count: vezesAvaliado } = await supabase
    .from("people").select("id", { count: "exact", head: true }).eq("user_id", userId);

  if (!row) {
    // Não é da equipe. Pode ser o dono da conta ou um avaliado que criou
    // login: o que separa os dois é ter cadastro próprio (`user_id`) sem ter
    // avaliados sob a sua gestão (`mentor_id`).
    const { count: tenhoAvaliados } = await supabase
      .from("people").select("id", { count: "exact", head: true }).eq("mentor_id", userId);
    const ehAluno = (vezesAvaliado ?? 0) > 0 && (tenhoAvaliados ?? 0) === 0;
    return {
      kind: (ehAluno ? "aluno" : "owner") as "owner" | "aluno",
      permissions: ehAluno ? [] : ([...PERMISSOES] as string[]),
      account_id: userId,
      member_id: null as string | null,
      // Dono que também é avaliado em outra conta. Aluno puro não precisa do
      // atalho: ele JÁ está na área dele.
      tambem_avaliado: !ehAluno && (vezesAvaliado ?? 0) > 0,
      groups: [] as Array<{ group_id: string; name: string; can_download_reports: boolean; can_schedule_mentorias: boolean }>,
    };
  }
  return {
    kind: row.kind as "mentor" | "colaborador" | "owner" | "aluno",
    // Mentor não tem permissões de funcionalidade: ele acessa os grupos dele.
    permissions: row.kind === "colaborador" ? row.permissions : ["relatorios"],
    account_id: row.owner_id,
    member_id: row.id,
    tambem_avaliado: (vezesAvaliado ?? 0) > 0,
    // Os grupos ATRIBUÍDOS a ele como mentor. Não confundir com os grupos em
    // que ele participa como avaliado: ser membro de um grupo e cuidar dele
    // são coisas diferentes, e só a segunda dá acesso aos resultados.
    groups: (row.team_member_groups ?? []).map((g) => ({
      group_id: g.group_id,
      name: g.groups?.name ?? "—",
      can_download_reports: g.can_download_reports,
      can_schedule_mentorias: g.can_schedule_mentorias ?? false,
    })),
  };
}

export const getMyMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => membershipDoUsuario(context.supabase, context.userId));

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

/**
 * Promove um avaliado a mentor.
 *
 * Substitui o convite de mentor. Quem é promovido já está cadastrado como
 * pessoa e já tem — ou vai ter, pelo primeiro acesso — o painel de aluno. Não
 * nasce segundo cadastro, segundo e-mail nem segundo painel: era exatamente
 * isso que fazia o mesmo e-mail virar duas identidades.
 */
export const promoverAMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("promover_a_mentor", { p_person_id: data.person_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Tira o papel. A pessoa continua avaliada, com o painel dela. */
export const rebaixarMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("rebaixar_mentor", { p_person_id: data.person_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Quem já é mentor, para a lista de pessoas mostrar o selo. */
export const idsDeMentores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // status='ativo': achado no #264. Sem este filtro, uma linha inativa
    // (ex.: incidente revertido à mão) continuava marcando a pessoa como
    // mentora na tela — inclusive trocando o botão "Promover" por
    // "Rebaixar" sem ela ter acesso nenhum de fato.
    const { data } = await context.supabase
      .from("team_members")
      .select("person_id")
      .eq("kind", "mentor")
      .eq("status", "ativo")
      .not("person_id", "is", null);
    return { ids: (data ?? []).map((x) => x.person_id as string) };
  });

/**
 * Os grupos que um mentor promovido cuida, com as duas chaves de cada um.
 *
 * Isto é o que substitui o diálogo do antigo menu Mentores. Devolve TODOS os
 * grupos da conta, marcando os atribuídos — sem isso a tela não teria como
 * oferecer os que faltam.
 *
 * Cuidar de um grupo é diferente de participar dele. O Matheus adicionou um
 * mentor a um grupo pelo cadastro e esperou que ele passasse a acompanhá-lo;
 * são caminhos separados de propósito, porque o mentor também é aluno e pode
 * estar num grupo só como participante.
 */
export const gruposDoMentor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { data: membro, error: eM } = await supabase
      .from("team_members").select("id").eq("person_id", data.person_id).eq("kind", "mentor").maybeSingle();
    if (eM) throw new Error(eM.message);
    if (!membro) return { grupos: [] };

    const [{ data: todos, error: eG }, { data: meus, error: eV }] = await Promise.all([
      supabase.from("groups").select("id, name").order("name"),
      supabase.from("team_member_groups")
        .select("group_id, can_download_reports, can_schedule_mentorias")
        .eq("team_member_id", membro.id),
    ]);
    if (eG) throw new Error(eG.message);
    if (eV) throw new Error(eV.message);

    return {
      grupos: (todos ?? []).map((g) => {
        const v = (meus ?? []).find((m) => m.group_id === g.id);
        return {
          group_id: g.id,
          name: g.name,
          atribuido: !!v,
          can_download_reports: v?.can_download_reports ?? false,
          can_schedule_mentorias: v?.can_schedule_mentorias ?? false,
        };
      }),
    };
  });

/**
 * Atribui (ou tira) um grupo, e ajusta as duas chaves.
 *
 * Ver dentro da plataforma vem junto com o grupo; baixar o relatório e agendar
 * devolutiva são opt-in, um de cada vez. Baixar é o mais sensível: o arquivo
 * sai da plataforma e deixa de ter controle nenhum.
 */
export const definirGrupoDoMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      person_id: z.string().uuid(),
      group_id: z.string().uuid(),
      atribuir: z.boolean(),
      can_download_reports: z.boolean().optional(),
      can_schedule_mentorias: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    // Só o dono da conta mexe nisto. Um mentor não amplia o próprio acesso.
    const { data: grupo, error: eG } = await supabase
      .from("groups").select("id").eq("id", data.group_id).eq("mentor_id", context.userId).maybeSingle();
    if (eG) throw new Error(eG.message);
    if (!grupo) throw new Error("Este grupo não é seu.");

    const { data: membro, error: eM } = await supabase
      .from("team_members").select("id").eq("person_id", data.person_id).eq("kind", "mentor").maybeSingle();
    if (eM) throw new Error(eM.message);
    if (!membro) throw new Error("Esta pessoa não é mentora.");

    if (!data.atribuir) {
      const { error } = await supabase.from("team_member_groups")
        .delete().eq("team_member_id", membro.id).eq("group_id", data.group_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { error } = await supabase.from("team_member_groups").upsert({
      team_member_id: membro.id,
      group_id: data.group_id,
      can_download_reports: data.can_download_reports ?? false,
      can_schedule_mentorias: data.can_schedule_mentorias ?? false,
    }, { onConflict: "team_member_id,group_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
