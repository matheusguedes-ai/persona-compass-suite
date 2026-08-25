/**
 * #221 F2 — emissão automática do certificado de conclusão.
 *
 * Escrita exclusiva do servidor (service role): a tabela `certificados` não
 * tem policy de INSERT/UPDATE/DELETE para `authenticated` (ver a migração)
 * — só o service role grava. Quem decide "concluiu" é sempre a régua
 * central (`regua-de-conclusao.ts`), já calculada por quem monta a lista de
 * conclusão (`calcularConclusoesDoTreinamento`/`calcularConclusoesDaTrilha`,
 * em classroom.functions.ts/learning.functions.ts). Esta função só grava o
 * que já foi decidido ali — nunca recalcula, nunca confia em percentual
 * vindo de outro lugar. Isso é o que garante "foto, não espelho": os quatro
 * campos congelados (nome, item, percentual exigido e atingido) só existem
 * porque foram copiados no instante exato da emissão.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type PessoaParaCertificado = {
  person_id: string;
  nome: string;
  percentual: number | null;
  percentual_exigido: number;
  concluido: boolean;
};

async function emitirSeElegivel(params: {
  contaId: string;
  pessoa: PessoaParaCertificado;
  nomeItem: string;
  treinamentoId?: string;
  trilhaId?: string;
}): Promise<void> {
  const { pessoa } = params;
  if (!pessoa.concluido || pessoa.percentual == null) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("certificados").insert({
    conta_id: params.contaId,
    person_id: pessoa.person_id,
    treinamento_id: params.treinamentoId ?? null,
    trilha_id: params.trilhaId ?? null,
    nome_pessoa: pessoa.nome,
    nome_item: params.nomeItem,
    percentual_exigido: pessoa.percentual_exigido,
    percentual_atingido: pessoa.percentual,
  });
  // 23505 = unique_violation (já emitido) — emissão é idempotente por
  // natureza, não é uma falha; qualquer outro erro sobe normalmente.
  if (error && error.code !== "23505") throw new Error(error.message);
}

/** Chamada depois de calcular a conclusão de TODA a turma de um
 * treinamento — emite para quem ainda não tem, ignora quem já tem (o índice
 * único cuida disso) e quem não concluiu. */
export async function garantirCertificadosDoTreinamento(
  contaId: string,
  treinamentoId: string,
  treinamentoTitulo: string,
  pessoas: PessoaParaCertificado[],
): Promise<void> {
  await Promise.all(
    pessoas
      .filter((p) => p.concluido)
      .map((p) =>
        emitirSeElegivel({ contaId, pessoa: p, nomeItem: treinamentoTitulo, treinamentoId }),
      ),
  );
}

/** Mesma coisa, lado Academy. */
export async function garantirCertificadosDaTrilha(
  contaId: string,
  trilhaId: string,
  trilhaTitulo: string,
  pessoas: PessoaParaCertificado[],
): Promise<void> {
  await Promise.all(
    pessoas
      .filter((p) => p.concluido)
      .map((p) => emitirSeElegivel({ contaId, pessoa: p, nomeItem: trilhaTitulo, trilhaId })),
  );
}

/** Quem já tem certificado emitido, por pessoa — para a lista do mentor
 * mostrar a data e para a tela do aluno saber que já pode baixar. Consulta
 * com o cliente autenticado de sempre (RLS decide quem vê), nunca o admin —
 * ler não precisa do bypass que só a emissão exige. */
export async function buscarCertificadosEmitidos(
  supabase: SupabaseClient<Database>,
  filtro: { treinamento_id: string } | { trilha_id: string },
): Promise<Map<string, { id: string; emitido_em: string }>> {
  const query = supabase.from("certificados").select("id, person_id, emitido_em");
  const { data, error } =
    "treinamento_id" in filtro
      ? await query.eq("treinamento_id", filtro.treinamento_id)
      : await query.eq("trilha_id", filtro.trilha_id);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((c) => [c.person_id, { id: c.id, emitido_em: c.emitido_em }]));
}

/** Dados do certificado para a página de PDF — só o que a régua de conteúdo
 * do certificado permite mostrar (requisito 4): nada de percentual aqui,
 * de propósito, para nem chegar ao navegador do aluno. RLS decide quem pode
 * ler esta linha (o próprio dono do certificado, ou a conta que o emitiu). */
export const getCertificadoParaPdf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ certificado_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: certificado, error } = await context.supabase
      .from("certificados")
      .select("nome_pessoa, nome_item, codigo, emitido_em")
      .eq("id", data.certificado_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!certificado) throw new Error("Certificado não encontrado.");
    return certificado;
  });
