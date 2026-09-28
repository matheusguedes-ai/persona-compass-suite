/**
 * #317 — NÍVEIS DA ASSISTENTE (Básica, Smart, Pro): quem LIBERA e quem ESCOLHE.
 *
 * - LIBERAR (o teto) é do DONO da conta — é ele quem arca com o consumo. Por GRUPO (aba Acesso da ficha
 *   do grupo) e por PESSOA (ficha da pessoa; precisa de login, porque a liberação individual é do login).
 *   O teto mora na PRÓPRIA linha de `assistente_liberacoes` (`categorias`): marcar ao menos um nível É
 *   liberar a assistente; desmarcar todos apaga a linha, e a assistente volta a ficar fechada para aquele
 *   grupo/pessoa. Não existe uma segunda tabela que possa discordar desta (a lição da #315). O que vale
 *   para o aluno é a SOMA: o login dele + todos os grupos dele (`assistente_categorias()`, no banco).
 * - ESCOLHER (dentro do teto) é de quem usa: o aluno, entre os liberados para ele; o mentor, entre os
 *   três. A escolha fica em `assistente_preferencias` e é conferida contra o teto a cada pergunta.
 *
 * `assistente_liberacoes` não tem policy para `authenticated`: lê e grava a chave de serviço, sempre
 * DEPOIS de conferir aqui quem pede e que o grupo/pessoa é da conta (lidos com o login de quem pede).
 * Este arquivo não lê conversa nenhuma — nem do aluno, nem do mentor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { membershipDoUsuario } from "@/lib/team.functions";
import { exigirAcessoAoGrupo, exigirPermissaoOuMentor } from "@/lib/permissao.server";
import { CATEGORIAS, naOrdem, type Categoria } from "@/lib/assistente/niveis";
import { tetoDoLogin } from "@/lib/assistente/niveis.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Cliente = SupabaseClient<Database>;

const zCategorias = z.array(z.enum(CATEGORIAS)).max(CATEGORIAS.length);

/** A conta, se quem pede é o dono dela; `null` para qualquer outro papel. */
async function contaSeDono(supabase: Cliente, userId: string): Promise<string | null> {
  const m = await membershipDoUsuario(supabase, userId);
  return m.kind === "owner" ? m.account_id : null;
}

async function exigirDono(supabase: Cliente, userId: string): Promise<string> {
  const conta = await contaSeDono(supabase, userId);
  if (!conta) throw new Error("Só o dono da conta libera os níveis da assistente.");
  return conta;
}

// ------------------------------------------------------------------------------------------ grupo

export type NivelDoGrupo = { categorias: Categoria[]; podeEditar: boolean };

export const nivelDaAssistenteDoGrupo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ group_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<NivelDoGrupo> => {
    const { supabase, userId } = context;
    await exigirAcessoAoGrupo(supabase, userId, data.group_id);
    // Lido com o login de quem pede: se a RLS não mostra o grupo, ele não é da conta.
    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("id, mentor_id")
      .eq("id", data.group_id)
      .maybeSingle();
    if (gErr) throw new Error(`Não foi possível ler o grupo (${gErr.message}).`);
    if (!g) throw new Error("Grupo não encontrado.");
    const db = await admin();
    const { data: lib, error } = await db
      .from("assistente_liberacoes")
      .select("categorias")
      .eq("group_id", g.id)
      .maybeSingle();
    if (error) throw new Error(`Não foi possível ler a assistente do grupo (${error.message}).`);
    const conta = await contaSeDono(supabase, userId);
    return {
      categorias: naOrdem(lib?.categorias),
      podeEditar: conta !== null && conta === g.mentor_id,
    };
  });

export const definirNivelDaAssistenteDoGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ group_id: z.string().uuid(), categorias: zCategorias }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const conta = await exigirDono(supabase, userId);
    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("id, mentor_id")
      .eq("id", data.group_id)
      .maybeSingle();
    if (gErr) throw new Error(`Não foi possível ler o grupo (${gErr.message}).`);
    if (!g || g.mentor_id !== conta) throw new Error("Grupo não encontrado.");

    const categorias = naOrdem(data.categorias);
    const db = await admin();
    const r = categorias.length
      ? await db
          .from("assistente_liberacoes")
          .upsert({ group_id: g.id, conta_id: conta, categorias }, { onConflict: "group_id" })
      : await db.from("assistente_liberacoes").delete().eq("group_id", g.id);
    if (r.error)
      throw new Error(`Não foi possível salvar a assistente do grupo (${r.error.message}).`);
    return { categorias };
  });

// ------------------------------------------------------------------------------------------ pessoa

export type NivelDaPessoa = {
  /** A liberação individual é do LOGIN: sem login, só dá para liberar pelos grupos. */
  temLogin: boolean;
  individual: Categoria[];
  porGrupo: Array<{ grupoId: string; grupo: string; categorias: Categoria[] }>;
  /** O que ela pode usar por esta conta: individual + grupos, somados. */
  total: Categoria[];
  podeEditar: boolean;
  /** A linha individual deste login foi feita por outra conta — daqui não se mexe nela. */
  deOutraConta: boolean;
};

export const nivelDaAssistenteDaPessoa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<NivelDaPessoa> => {
    const { supabase, userId } = context;
    await exigirPermissaoOuMentor(supabase, userId, "pessoas");
    // Com o login de quem pede: a RLS de `people` (can_see_person) decide se esta ficha é visível.
    const { data: p, error: pErr } = await supabase
      .from("people")
      .select("id, user_id, mentor_id")
      .eq("id", data.person_id)
      .maybeSingle();
    if (pErr) throw new Error(`Não foi possível ler a pessoa (${pErr.message}).`);
    if (!p) throw new Error("Pessoa não encontrada.");

    // Os grupos DESTE cadastro. Uma pessoa está em poucos grupos; a leitura não cresce com a conta.
    const { data: membros, error: mErr } = await supabase
      .from("group_members")
      .select("group_id, groups(name)")
      .eq("person_id", p.id)
      .order("group_id");
    if (mErr) throw new Error(`Não foi possível ler os grupos da pessoa (${mErr.message}).`);
    const grupos = (membros ?? []).map((m) => ({ id: m.group_id, nome: m.groups?.name ?? "—" }));

    const db = await admin();
    const [porGrupoLido, individualLido] = await Promise.all([
      grupos.length
        ? db
            .from("assistente_liberacoes")
            .select("group_id, categorias")
            .in(
              "group_id",
              grupos.map((g) => g.id),
            )
        : Promise.resolve({
            data: [] as Array<{ group_id: string | null; categorias: string[] }>,
            error: null,
          }),
      p.user_id
        ? db
            .from("assistente_liberacoes")
            .select("conta_id, categorias")
            .eq("user_id", p.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (porGrupoLido.error)
      throw new Error(
        `Não foi possível ler a assistente dos grupos (${porGrupoLido.error.message}).`,
      );
    if (individualLido.error)
      throw new Error(
        `Não foi possível ler a assistente da pessoa (${individualLido.error.message}).`,
      );

    const porGrupo = grupos
      .map((g) => ({
        grupoId: g.id,
        grupo: g.nome,
        categorias: naOrdem((porGrupoLido.data ?? []).find((l) => l.group_id === g.id)?.categorias),
      }))
      .filter((g) => g.categorias.length > 0);
    const deOutraConta = !!individualLido.data && individualLido.data.conta_id !== p.mentor_id;
    const individual = deOutraConta ? [] : naOrdem(individualLido.data?.categorias);
    const conta = await contaSeDono(supabase, userId);
    return {
      temLogin: !!p.user_id,
      individual,
      porGrupo,
      total: naOrdem([...individual, ...porGrupo.flatMap((g) => g.categorias)]),
      podeEditar: conta !== null && conta === p.mentor_id && !!p.user_id && !deOutraConta,
      deOutraConta,
    };
  });

export const definirNivelDaAssistenteDaPessoa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ person_id: z.string().uuid(), categorias: zCategorias }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const conta = await exigirDono(supabase, userId);
    const { data: p, error: pErr } = await supabase
      .from("people")
      .select("id, user_id, mentor_id")
      .eq("id", data.person_id)
      .maybeSingle();
    if (pErr) throw new Error(`Não foi possível ler a pessoa (${pErr.message}).`);
    if (!p || p.mentor_id !== conta) throw new Error("Pessoa não encontrada.");
    if (!p.user_id) {
      throw new Error(
        "Esta pessoa ainda não tem login na plataforma. Libere pelo grupo, ou depois que ela entrar pela primeira vez.",
      );
    }

    const db = await admin();
    const { data: atual, error: aErr } = await db
      .from("assistente_liberacoes")
      .select("id, conta_id")
      .eq("user_id", p.user_id)
      .maybeSingle();
    if (aErr) throw new Error(`Não foi possível ler a assistente da pessoa (${aErr.message}).`);
    if (atual && atual.conta_id !== conta)
      throw new Error("A assistente deste login foi liberada por outra conta.");

    const categorias = naOrdem(data.categorias);
    const r = !categorias.length
      ? atual
        ? await db.from("assistente_liberacoes").delete().eq("id", atual.id)
        : { error: null }
      : atual
        ? await db.from("assistente_liberacoes").update({ categorias }).eq("id", atual.id)
        : await db
            .from("assistente_liberacoes")
            .insert({ user_id: p.user_id, conta_id: conta, categorias });
    if (r.error)
      throw new Error(`Não foi possível salvar a assistente da pessoa (${r.error.message}).`);
    return { categorias };
  });

// ------------------------------------------------------------------------------------------ escolha

/**
 * A escolha de quem usa, lembrada para a próxima vez. O aluno só escolhe o que está no teto DELE agora;
 * o mentor, qualquer um dos três. Quem é "quem usa" é sempre o login da sessão — nada vem do navegador.
 */
export const escolherNivelDaAssistente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ escopo: z.enum(["aluno", "mentor"]), categoria: z.enum(CATEGORIAS) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let conta: string;
    if (data.escopo === "mentor") {
      const { data: ok, error } = await supabase.rpc("assistente_mentor_liberada");
      if (error) throw new Error(`Não foi possível consultar a assistente (${error.message}).`);
      if (ok !== true) throw new Error("A assistente do painel não está liberada para este login.");
      conta = userId; // o portão garante acting_account() = o próprio login
    } else {
      const teto = await tetoDoLogin(supabase, "aluno");
      if (!teto.includes(data.categoria))
        throw new Error("Este nível não está liberado para você.");
      const { data: c, error } = await supabase.rpc("conta_do_autor", { p_author_id: userId });
      if (error || !c) throw new Error("Não foi possível identificar a sua conta.");
      conta = c as string;
    }
    const db = await admin();
    const { error } = await db.from("assistente_preferencias").upsert(
      {
        user_id: userId,
        escopo: data.escopo,
        conta_id: conta,
        categoria: data.categoria,
        atualizada_em: new Date().toISOString(),
      },
      { onConflict: "user_id,escopo" },
    );
    if (error) throw new Error(`Não foi possível guardar a sua escolha (${error.message}).`);
    return { categoria: data.categoria };
  });
