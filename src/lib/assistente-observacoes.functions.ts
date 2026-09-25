/**
 * OBSERVAÇÕES DO MENTOR PARA A ASSISTENTE (#305, Nível 2).
 *
 * O mentor registra, na ficha da pessoa, o que a assistente deve ter em mente ao conversar com ela.
 * O fluxo é de MÃO ÚNICA: mentor → assistente. Nada aqui lê conversa do aluno (continua sem caminho
 * nenhum para isso — ver `assistente.functions.ts`), e o aluno não tem função nem policy que leia
 * estas linhas.
 *
 * Tudo com o login de quem está na tela: a RLS (`aobs_equipe`) recorta pela conta e por
 * `can_see_person` — a mesma regra da ficha da pessoa (o mentor convidado só vê quem está nos grupos
 * dele) — e recusa observação sobre o próprio login. A conta e o autor são preenchidos pelo banco.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissaoOuMentor } from "@/lib/permissao.server";

export type ObservacaoDaAssistente = { id: string; texto: string; criada_em: string; atualizada_em: string };

const TEXTO = z.string().trim().min(1, "Escreva a observação.").max(2000, "No máximo 2.000 caracteres.");

export const listarObservacoesDaAssistente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "pessoas");
    const { data: linhas, error } = await context.supabase
      .from("assistente_observacoes")
      .select("id, texto, criada_em, atualizada_em")
      .eq("person_id", data.person_id)
      .order("criada_em", { ascending: false })
      .order("id");
    if (error) throw new Error(`Não foi possível ler as observações (${error.message}).`);
    return (linhas ?? []) as ObservacaoDaAssistente[];
  });

export const salvarObservacaoDaAssistente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ person_id: z.string().uuid(), id: z.string().uuid().nullable().optional(), texto: TEXTO }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "pessoas");
    if (data.id) {
      const { data: linha, error } = await context.supabase
        .from("assistente_observacoes")
        .update({ texto: data.texto })
        .eq("id", data.id)
        .eq("person_id", data.person_id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`Não foi possível salvar a observação (${error.message}).`);
      if (!linha) throw new Error("Observação não encontrada.");
      return { id: linha.id };
    }
    // `conta_id` é obrigatório no tipo, mas quem decide é o gatilho (a conta do cadastro): o valor
    // mandado aqui é descartado. Mandar a conta de quem está logado deixa a intenção clara.
    const { data: conta, error: cErr } = await context.supabase.rpc("acting_account");
    if (cErr || !conta) throw new Error("Não foi possível identificar a sua conta.");
    const { data: linha, error } = await context.supabase
      .from("assistente_observacoes")
      .insert({ person_id: data.person_id, conta_id: conta as string, texto: data.texto })
      .select("id")
      .single();
    if (error) {
      throw new Error(
        error.code === "42501"
          ? "Você não pode registrar observação para esta pessoa."
          : `Não foi possível salvar a observação (${error.message}).`,
      );
    }
    return { id: linha.id };
  });

export const apagarObservacaoDaAssistente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "pessoas");
    const { data: apagadas, error } = await context.supabase
      .from("assistente_observacoes")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(`Não foi possível apagar a observação (${error.message}).`);
    if (!apagadas?.length) throw new Error("Observação não encontrada.");
    return { ok: true as const };
  });
