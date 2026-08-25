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
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PublicBrand } from "@/lib/brand.server";

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

// ============================================================
// #221 F3 — verificação pública (sem login)
// ============================================================

/**
 * 10 minutos, 30 tentativas: generoso pra quem erra digitando ou está numa
 * rede compartilhada (wifi de evento, escritório do RH), curto pra quem
 * tenta varrer código em sequência. O código em si é um uuid aleatório de
 * 122 bits — adivinhar por força bruta já é inviável matematicamente antes
 * de qualquer limite; isto aqui é camada extra, contra abuso e custo, não a
 * única trava.
 */
const JANELA_LIMITE_MS = 10 * 60 * 1000;
const MAX_TENTATIVAS = 30;

/** Cloudflare (hospedagem do Lovable) preenche `cf-connecting-ip` com o IP
 * real de quem pediu; `x-forwarded-for` é o fallback fora dali. Em dev local
 * nenhum dos dois existe — todo pedido cai na mesma origem "desconhecida",
 * o que é inofensivo (só afeta o próprio teste local). */
function origemDaRequisicao(request: Request | undefined | null): string {
  if (!request) return "desconhecida";
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || "desconhecida";
}

/** true = bloqueado. Uma linha por origem, sem histórico de tentativa por
 * tentativa — a janela vencida é sobrescrita, não acumulada. */
async function excedeuLimiteDeVerificacao(
  supabaseAdmin: SupabaseClient<Database>,
  origem: string,
): Promise<boolean> {
  const agora = Date.now();
  const { data: linha } = await supabaseAdmin
    .from("verificacao_certificado_limite")
    .select("janela_inicio, tentativas")
    .eq("origem", origem)
    .maybeSingle();

  const dentroDaJanela =
    linha != null && agora - new Date(linha.janela_inicio).getTime() < JANELA_LIMITE_MS;

  if (!dentroDaJanela) {
    await supabaseAdmin
      .from("verificacao_certificado_limite")
      .upsert({ origem, janela_inicio: new Date(agora).toISOString(), tentativas: 1 });
    return false;
  }

  if (linha.tentativas >= MAX_TENTATIVAS) return true;

  await supabaseAdmin
    .from("verificacao_certificado_limite")
    .update({ tentativas: linha.tentativas + 1 })
    .eq("origem", origem);
  return false;
}

/** Só logo + nome — o resto de `PublicBrand` (cor, site, e-mail de suporte)
 * ninguém usa nesta tela. Endpoint público de verdade, sem sessão nenhuma:
 * o mesmo cuidado de `loadPublicLoginBrand` (nunca devolver mais do que a
 * tela mostra) vale em dobro aqui. */
type MarcaMinima = Pick<PublicBrand, "company_name" | "logo_url">;

type ResultadoVerificacao =
  | { estado: "limite" }
  | { estado: "nao_encontrado" }
  | {
      estado: "valido";
      nome_pessoa: string;
      nome_item: string;
      emitido_em: string;
      brand: MarcaMinima | null;
    };

/**
 * Consulta pública por código EXATO — nunca por nome, nunca lista nada.
 * Service role de propósito (bypassa RLS): quem abre esta página não tem
 * sessão, então não existe cliente autenticado para perguntar. Só devolve o
 * que a Fatia 3 autoriza mostrar (requisito 2): nome, item, data e a marca
 * de quem emitiu — sem percentual, sem id interno, sem conta_id.
 *
 * Código que não bate com nenhum certificado E código mal formado (não-uuid,
 * que o Postgres rejeitaria na comparação) caem na MESMA resposta genérica
 * — não existe jeito de, pela resposta, diferenciar "não existe" de "você
 * digitou errado o formato" (requisito 3).
 */
export const verificarCertificado = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ codigo: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data }): Promise<ResultadoVerificacao> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origem = origemDaRequisicao(getRequest());

    if (await excedeuLimiteDeVerificacao(supabaseAdmin, origem)) {
      return { estado: "limite" };
    }

    const { data: certificado, error } = await supabaseAdmin
      .from("certificados")
      .select("nome_pessoa, nome_item, emitido_em, conta_id")
      .eq("codigo", data.codigo.toLowerCase())
      .maybeSingle();
    if (error || !certificado) return { estado: "nao_encontrado" };

    const { loadBrandAndSettings } = await import("@/lib/brand.server");
    const { brand } = await loadBrandAndSettings(certificado.conta_id);
    const marca: MarcaMinima | null = brand
      ? { company_name: brand.company_name, logo_url: brand.logo_url }
      : null;

    return {
      estado: "valido",
      nome_pessoa: certificado.nome_pessoa,
      nome_item: certificado.nome_item,
      emitido_em: certificado.emitido_em,
      brand: marca,
    };
  });
