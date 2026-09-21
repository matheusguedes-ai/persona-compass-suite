/**
 * A ponte entre o pedido HTTP e o PDF (#293, fatia 1).
 *
 * Junta o que o documento precisa — o relatório, o plano de ação e a permissão de quem pediu — e
 * devolve a resposta com o arquivo. O acesso é exatamente o mesmo da tela:
 *
 *   - o DADO já vem travado por `buildReport`, que barra pessoa que a sessão não alcança;
 *   - o DOWNLOAD passa pela mesma `regraDeDownload` que o botão da tela consulta, agora rodando
 *     também no servidor. Antes desta fatia isso era só interface: sumia o botão, mas quem
 *     montasse o pedido na mão passava. Agora o endpoint recusa.
 */
import { getRequest } from "@tanstack/react-start/server";
import { buildBatteryReport, buildReport } from "@/lib/report.server";
import { regraDeDownload } from "@/lib/team.functions";
import { siteUrl } from "@/lib/site-url.server";
import { limpar } from "./doc";
import { pdfDaBateria, pdfDoRelatorio, type BateriaParte } from "./relatorio";
import type { Report } from "@/components/report/sections";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * A origem de onde buscar fonte e logo. Vem do próprio pedido — assim o servidor local pega os
 * arquivos do servidor local, e produção pega os de produção, sem variável nova. `siteUrl()` é só
 * a rede de segurança.
 */
function origemDoPedido(): string {
  try {
    const url = getRequest()?.url;
    if (url) return new URL(url).origin;
  } catch {
    // Sem request no escopo (não deve acontecer numa rota): cai no domínio configurado.
  }
  return siteUrl();
}

/** A sessão de quem pediu, quando houver — o mesmo `Authorization: Bearer` que a tela envia. */
async function sessaoDoPedido(): Promise<{ supabase: ClienteEscopado; userId: string } | null> {
  const authHeader = getRequest()?.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const supabase = await clienteEscopado(token);
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { supabase, userId: data.user.id };
  } catch {
    return null;
  }
}

type ClienteEscopado = SupabaseClient<Database>;

async function clienteEscopado(token: string): Promise<ClienteEscopado | null> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) return null;
  return createClient<Database>(url, chave, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Pode baixar? Duas situações, como em `pode-baixar.ts`:
 *   - sem sessão (o avaliado abrindo pelo link): vale o `allow_pdf` das Configurações do mentor;
 *   - com sessão: vale a regra de equipe, que é onde mora o "pode baixar" do mentor convidado.
 */
async function podeBaixar(responseId: string, allowPdf: boolean): Promise<boolean> {
  const sessao = await sessaoDoPedido();
  if (!sessao) return allowPdf;
  try {
    const { allowed } = await regraDeDownload(sessao.supabase, sessao.userId, responseId);
    return allowed;
  } catch {
    // Mesma escolha da tela: na dúvida, NÃO liberar.
    return false;
  }
}

/** Respostas já escritas no plano de ação, para o PDF sair com o que a pessoa preencheu. */
async function planoDe(responseIds: string[]): Promise<Record<string, Record<string, string>>> {
  if (responseIds.length === 0) return {};
  const supabase = await getAdmin();
  const { data, error } = await supabase
    .from("action_plans")
    .select("response_id, answers")
    .in("response_id", responseIds);
  if (error) throw new Error(error.message);
  const saida: Record<string, Record<string, string>> = {};
  for (const linha of data ?? []) {
    saida[linha.response_id] = (linha.answers ?? {}) as Record<string, string>;
  }
  return saida;
}

/**
 * Nome do arquivo que a pessoa vê no Downloads. Vai nas duas formas porque navegador antigo só lê
 * a ASCII, e "Relatório" sem acento é melhor do que um nome ilegível.
 */
function disposicao(nome: string): string {
  const limpo = limpar(nome).replace(/[\\/:*?"<>|]/g, "-").slice(0, 120);
  const ascii = limpo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim() || "relatorio";
  return `attachment; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(limpo)}.pdf`;
}

function erro(mensagem: string, status: number) {
  return new Response(JSON.stringify({ error: mensagem }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function respostaPdf(bytes: Uint8Array, nome: string) {
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": disposicao(nome),
      "content-length": String(bytes.byteLength),
      // O PDF traz dado pessoal: nunca em cache compartilhado.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function servirPdfDoRelatorio(responseId: string): Promise<Response> {
  const out = await buildReport(responseId);
  if (out.status === 404) return erro(out.error, 404);
  const r = out.data as Report;
  if (!(await podeBaixar(responseId, r.settings?.allow_pdf !== false))) {
    return erro("O download deste relatório não está liberado para você.", 403);
  }
  const oculto = r.settings?.hidden_blocks ?? [];
  const planos = await planoDe([responseId]);
  const bytes = await pdfDoRelatorio({
    report: r,
    origem: origemDoPedido(),
    plano: planos[responseId] ?? {},
    mostrarPlano: !oculto.includes("plano_acao"),
  });
  return respostaPdf(bytes, `Relatorio - ${r.person_name ?? "Avaliado"} - ${r.test_title ?? "Inventario"}`);
}

export async function servirPdfDaBateria(assessmentId: string): Promise<Response> {
  const out = await buildBatteryReport(assessmentId);
  if (out.status === 404) return erro(out.error, 404);
  const b = out.data;
  const partes = b.parts as unknown as BateriaParte[];
  const ids = partes.map((p) => p.response_id).filter((id): id is string => !!id);
  // A bateria é de UMA pessoa: a permissão da primeira etapa vale para o documento inteiro.
  if (ids.length > 0 && !(await podeBaixar(ids[0], b.settings?.allow_pdf !== false))) {
    return erro("O download deste relatório não está liberado para você.", 403);
  }
  const oculto = b.settings?.hidden_blocks ?? [];
  const ultimaData = b.submitted_at ?? partes[partes.length - 1]?.submitted_at;
  if (!ultimaData) return erro("Relatório indisponível: nenhuma etapa concluída.", 404);
  // O plano é UM por bateria, salvo na etapa principal (DISC quando houver) — como na tela.
  const principal = partes.find((p) => p.is_disc) ?? partes[0];
  const planos = await planoDe(principal?.response_id ? [principal.response_id] : []);
  const bytes = await pdfDaBateria({
    bateria: { ...b, submitted_at: ultimaData, parts: partes },
    origem: origemDoPedido(),
    plano: (principal?.response_id && planos[principal.response_id]) || {},
    mostrarPlano: !oculto.includes("plano_acao"),
  });
  return respostaPdf(bytes, `Relatorio da bateria - ${b.person_name ?? "Avaliado"}`);
}
