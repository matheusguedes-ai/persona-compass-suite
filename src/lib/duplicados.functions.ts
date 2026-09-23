/**
 * #300 (entrega 2) — o mentor vê e unifica cadastros repetidos.
 *
 * A plataforma SUGERE, o mentor DECIDE: nada aqui funde sozinho. A lista sai
 * da mesma comparação que o link aberto usa (`duplicidade.ts`: telefone igual
 * ou nome muito parecido, dentro da mesma conta), mais as suspeitas que o
 * link registrou. A unificação mostra uma prévia antes e, feita, deixa um
 * registro completo do que existiu (`fusoes_pessoas`).
 *
 * Quem pode: o dono da conta, ou o colaborador com permissão de Pessoas. O
 * mentor convidado não — ele enxerga só os grupos dele, e unificar mexe em
 * cadastros da conta inteira.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/lib/permissao.server";
import { motivoDeSuspeita, type MotivoSuspeita } from "@/lib/duplicidade";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type PessoaResumo = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  tem_login: boolean;
  created_at: string;
  respostas: number;
  respostas_entregues: number;
  grupos: string[];
};

export type ParRepetido = {
  a: PessoaResumo;
  b: PessoaResumo;
  motivo: MotivoSuspeita;
  /** No link aberto, a pessoa respondeu "não, é meu primeiro cadastro". */
  disse_que_era_nova: boolean;
  /** Quem a tela sugere manter: quem tem login; empatado, o cadastro mais antigo. */
  sugestao_manter: string;
};

export type PreviaFusao = {
  bloqueios: string[];
  mover?: Record<string, number>;
  conflitos?: Record<string, number>;
  campos?: Record<string, string>;
  login?: "mantido" | "movido" | "nenhum" | "conflito";
};

const chavePar = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

/** A conta de quem pede, já checada a permissão de Pessoas. */
async function contaDeQuemPede(supabase: SupabaseClient<Database>, userId: string) {
  const m = await exigirPermissao(supabase, userId, "pessoas");
  return m.account_id;
}

/** Os dois cadastros existem e são da conta de quem pede — senão, nada acontece. */
async function conferirPar(supabase: SupabaseClient<Database>, contaId: string, x: string, y: string) {
  if (x === y) throw new Error("Escolha dois cadastros diferentes.");
  const { data, error } = await supabase
    .from("people").select("id, created_at").eq("mentor_id", contaId).in("id", [x, y]);
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== 2) throw new Error("Cadastro não encontrado ou fora da sua conta.");
  return data!;
}

export const listarCadastrosRepetidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const contaId = await contaDeQuemPede(context.supabase, context.userId);

    // `.eq("mentor_id", contaId)` e não só a RLS: quem é dono aqui e avaliado
    // em outra conta enxerga o próprio cadastro de lá (`people_self_read`), e
    // ele não pode entrar na comparação desta conta.
    const { data: pessoas, error } = await context.supabase
      .from("people")
      .select("id, full_name, email, phone, user_id, created_at")
      .eq("mentor_id", contaId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const lista = pessoas ?? [];

    const { data: suspeitas, error: sErr } = await context.supabase
      .from("suspeitas_duplicidade")
      .select("pessoa_nova_id, pessoa_existente_id, motivo, status, origem")
      .eq("mentor_id", contaId);
    if (sErr) throw new Error(sErr.message);
    const descartados = new Set(
      (suspeitas ?? []).filter((s) => s.status === "descartada").map((s) => chavePar(s.pessoa_nova_id, s.pessoa_existente_id)),
    );
    const disseQueEraNova = new Set(
      (suspeitas ?? []).filter((s) => s.origem === "link_aberto").map((s) => chavePar(s.pessoa_nova_id, s.pessoa_existente_id)),
    );

    const pares: { a: (typeof lista)[number]; b: (typeof lista)[number]; motivo: MotivoSuspeita }[] = [];
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const motivo = motivoDeSuspeita(lista[i], lista[j]);
        if (motivo && !descartados.has(chavePar(lista[i].id, lista[j].id))) {
          pares.push({ a: lista[i], b: lista[j], motivo });
        }
      }
    }
    if (pares.length === 0) return { pares: [] as ParRepetido[] };

    // Contagens para o mentor decidir: respostas (entregues) e grupos de cada um.
    const ids = [...new Set(pares.flatMap((p) => [p.a.id, p.b.id]))];
    const sb = await admin();
    const [{ data: respostas, error: rErr }, { data: membros, error: gErr }] = await Promise.all([
      sb.from("test_responses").select("person_id, submitted_at").in("person_id", ids),
      sb.from("group_members").select("person_id, groups(name)").in("person_id", ids),
    ]);
    if (rErr) throw new Error(rErr.message);
    if (gErr) throw new Error(gErr.message);

    const resumo = (p: (typeof lista)[number]): PessoaResumo => {
      const minhas = (respostas ?? []).filter((r) => r.person_id === p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        tem_login: !!p.user_id,
        created_at: p.created_at,
        respostas: minhas.length,
        respostas_entregues: minhas.filter((r) => r.submitted_at).length,
        grupos: (membros ?? []).filter((m) => m.person_id === p.id).map((m) => m.groups?.name ?? "—"),
      };
    };

    return {
      pares: pares.map(({ a, b, motivo }): ParRepetido => {
        // Sugestão: quem tem login fica (é a conta que a pessoa usa para
        // entrar); empatado, o cadastro mais antigo (é o que o mentor fez).
        const sugestao = a.user_id && !b.user_id ? a.id
          : b.user_id && !a.user_id ? b.id
          : a.created_at <= b.created_at ? a.id : b.id;
        return {
          a: resumo(a),
          b: resumo(b),
          motivo,
          disse_que_era_nova: disseQueEraNova.has(chavePar(a.id, b.id)),
          sugestao_manter: sugestao,
        };
      }),
    };
  });

const parSchema = z.object({ manter: z.string().uuid(), absorver: z.string().uuid() });

export const previaDaUnificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => parSchema.parse(d))
  .handler(async ({ data, context }) => {
    const contaId = await contaDeQuemPede(context.supabase, context.userId);
    await conferirPar(context.supabase, contaId, data.manter, data.absorver);
    const sb = await admin();
    const { data: previa, error } = await sb.rpc("previa_fusao", { p_manter: data.manter, p_absorver: data.absorver });
    if (error) throw new Error(error.message);
    return previa as unknown as PreviaFusao;
  });

export const unificarCadastros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => parSchema.parse(d))
  .handler(async ({ data, context }) => {
    const contaId = await contaDeQuemPede(context.supabase, context.userId);
    await conferirPar(context.supabase, contaId, data.manter, data.absorver);
    const sb = await admin();
    const { data: resultado, error } = await sb.rpc("fundir_pessoas", {
      p_manter: data.manter, p_absorver: data.absorver, p_por: context.userId,
    });
    // As recusas da função vêm escritas em português para o mentor (logins
    // diferentes, certificado repetido...) — passam direto.
    if (error) throw new Error(error.message);
    return resultado as unknown as { fusao_id: string };
  });

/** "Não são a mesma pessoa": o par para de aparecer na lista. */
export const naoSaoAMesmaPessoa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pessoa_a: z.string().uuid(), pessoa_b: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const contaId = await contaDeQuemPede(context.supabase, context.userId);
    const par = await conferirPar(context.supabase, contaId, data.pessoa_a, data.pessoa_b);
    // Mesmo sentido que o link aberto usa: a "nova" é a cadastrada depois.
    const [antiga, nova] = [...par].sort((x, y) => x.created_at.localeCompare(y.created_at));
    const sb = await admin();

    const { data: existente, error: eErr } = await sb
      .from("suspeitas_duplicidade")
      .select("id")
      .or(`and(pessoa_nova_id.eq.${nova.id},pessoa_existente_id.eq.${antiga.id}),and(pessoa_nova_id.eq.${antiga.id},pessoa_existente_id.eq.${nova.id})`);
    if (eErr) throw new Error(eErr.message);

    const agora = new Date().toISOString();
    if (existente && existente.length > 0) {
      const { error } = await sb.from("suspeitas_duplicidade")
        .update({ status: "descartada", resolvida_em: agora, resolvida_por: context.userId })
        .in("id", existente.map((e) => e.id));
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }

    const { data: pessoas, error: pErr } = await sb
      .from("people").select("id, full_name, phone").in("id", [nova.id, antiga.id]);
    if (pErr) throw new Error(pErr.message);
    const pn = pessoas?.find((p) => p.id === nova.id);
    const pa = pessoas?.find((p) => p.id === antiga.id);
    const motivo = pn && pa ? motivoDeSuspeita(pn, pa) ?? "nome" : "nome";
    const { error } = await sb.from("suspeitas_duplicidade").insert({
      mentor_id: contaId,
      pessoa_nova_id: nova.id,
      pessoa_existente_id: antiga.id,
      motivo,
      origem: "varredura",
      status: "descartada",
      resolvida_em: agora,
      resolvida_por: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
