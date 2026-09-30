/**
 * Consentimento de WhatsApp — o que a TELA pede ao servidor (#291 F1b).
 *
 * QUEM PODE ACEITAR: só o próprio aluno, logado com o login dele. As ações NÃO recebem id de pessoa: agem sobre o
 * cadastro cujo `user_id` é quem está logado. O dono nunca aceita em nome do aluno — nem pela tela ("Ver como
 * aluno" é só leitura) nem por chamada direta: qualquer chamada de ação que traga `preview_person_id` é recusada.
 *
 * Todo envio (o código) sai pela camada de canal da F1a; a tela nunca fala com a Zapster.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mascararTelefone } from "@/lib/canal/telefone";
import {
  NIVEIS_WHATSAPP, TERMO_TEXTO, TERMO_VERSAO, CODIGO_MAX_POR_HORA, CODIGO_VALIDADE_MINUTOS, type NivelWhatsapp,
} from "@/lib/canal/consentimento";

const nivelSchema = z.enum(NIVEIS_WHATSAPP as unknown as [NivelWhatsapp, ...NivelWhatsapp[]]);
const aceiteSchema = z.object({
  preview_person_id: z.string().uuid().nullable().optional(),
  aceiteTermo: z.literal(true),
  termoVersao: z.literal(TERMO_VERSAO),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Erros que a tela pode mostrar como estão; o resto vira mensagem genérica e vai ao log do servidor. */
async function comoMensagem<T>(f: () => Promise<T>): Promise<T> {
  const { ErroDeConsentimento } = await import("@/lib/canal/consentimento.server");
  try {
    return await f();
  } catch (e) {
    if (e instanceof ErroDeConsentimento) throw e;
    console.error("[whatsapp-consentimento]", e instanceof Error ? e.message : "erro");
    throw new Error("Não consegui concluir agora. Tente de novo em instantes.");
  }
}

/** O estado da tela: telefone mascarado, consentimento vigente, e se é só leitura ("Ver como aluno"). */
export const getMeuWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const somenteLeitura = !!data.preview_person_id;
    const q = supabase.from("people").select("id, mentor_id, full_name, phone");
    const { data: rows, error } = somenteLeitura
      ? await q.eq("id", data.preview_person_id!).limit(1)
      : await q.eq("user_id", userId).order("created_at", { ascending: true }).limit(1);
    if (error) throw new Error(error.message);
    const p = (rows ?? [])[0];
    if (!p) return { temCadastro: false as const, somenteLeitura };

    const { consentimentoVigente } = await import("@/lib/canal/consentimento.server");
    const { vigente, numeroMudou } = await consentimentoVigente(await admin(), p);
    return {
      temCadastro: true as const,
      somenteLeitura,
      telefoneMascarado: p.phone ? mascararTelefone(p.phone) : null,
      vigente: vigente ? { nivel: vigente.nivel, desde: vigente.aceito_em } : null,
      numeroMudou,
      termo: { versao: TERMO_VERSAO, texto: TERMO_TEXTO },
      limites: { codigosPorHora: CODIGO_MAX_POR_HORA, validadeMinutos: CODIGO_VALIDADE_MINUTOS },
    };
  });

/** Pede o código de confirmação (enviado ao WhatsApp do cadastro). */
export const pedirCodigoWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ nivel: nivelSchema, preview_person_id: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pessoa = await (await import("@/lib/canal/consentimento.server")).pessoaDoLogin(supabase as never, userId, data.preview_person_id);
    return comoMensagem(async () => {
      const { pedirCodigo } = await import("@/lib/canal/consentimento.server");
      return pedirCodigo(await admin(), { pessoa, userId, nivel: data.nivel });
    });
  });

/** Confere o código. Só aqui o aceite passa a valer. */
export const confirmarCodigoWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => aceiteSchema.extend({ codigo: z.string().trim().min(1).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pessoa = await (await import("@/lib/canal/consentimento.server")).pessoaDoLogin(supabase as never, userId, data.preview_person_id);
    return comoMensagem(async () => {
      const { confirmarCodigo } = await import("@/lib/canal/consentimento.server");
      return confirmarCodigo(await admin(), { pessoa, userId, codigo: data.codigo });
    });
  });

/** Essencial ⇄ Completo, com o WhatsApp já confirmado. Sem novo código. */
export const mudarNivelWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => aceiteSchema.extend({ nivel: nivelSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pessoa = await (await import("@/lib/canal/consentimento.server")).pessoaDoLogin(supabase as never, userId, data.preview_person_id);
    return comoMensagem(async () => {
      const { mudarNivel } = await import("@/lib/canal/consentimento.server");
      return mudarNivel(await admin(), { pessoa, userId, nivel: data.nivel });
    });
  });

/** Desliga o WhatsApp. Vale na hora; não pede código. */
export const desligarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pessoa = await (await import("@/lib/canal/consentimento.server")).pessoaDoLogin(supabase as never, userId, data.preview_person_id);
    return comoMensagem(async () => {
      const { desligar } = await import("@/lib/canal/consentimento.server");
      return desligar(await admin(), { pessoa, userId });
    });
  });

/** "Meu número está errado": avisa o mentor pelo sino. O aluno NÃO edita o telefone. */
export const avisarNumeroErrado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pessoa = await (await import("@/lib/canal/consentimento.server")).pessoaDoLogin(supabase as never, userId, data.preview_person_id);
    return comoMensagem(async () => {
      const { avisarNumeroErrado: avisar } = await import("@/lib/canal/consentimento.server");
      return avisar(await admin(), { pessoa, userId });
    });
  });

/** Lado do MENTOR: só o status, só leitura. A RLS da tabela decide quem enxerga o quê. */
export const getWhatsappDaPessoa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: p } = await supabase.from("people").select("id, phone").eq("id", data.person_id).maybeSingle();
    if (!p) return { status: "nao_autorizado" as const };
    const { data: linhas, error } = await supabase
      .from("whatsapp_consentimentos")
      .select("nivel, aceito_em, revogado_em, destino_mascarado")
      .eq("person_id", data.person_id).order("aceito_em", { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    const ultima = (linhas ?? [])[0];
    if (!ultima) return { status: "nao_autorizado" as const };
    if (ultima.revogado_em) return { status: "desligado" as const, em: ultima.revogado_em };
    if (ultima.destino_mascarado !== mascararTelefone(p.phone)) {
      return { status: "numero_mudou" as const, nivel: ultima.nivel as NivelWhatsapp, desde: ultima.aceito_em };
    }
    return { status: "autorizado" as const, nivel: ultima.nivel as NivelWhatsapp, desde: ultima.aceito_em };
  });
