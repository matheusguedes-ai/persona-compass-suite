/**
 * Biblioteca — material que não pertence a aula nenhuma.
 *
 * #313: menu próprio (fora da Academy), pastas em até 3 níveis e acesso em três camadas — menu por
 * grupo, pasta, material —, com bloqueio que sempre vence. QUEM VÊ O QUÊ é decidido num lugar só,
 * a função `bib_decide` do banco; aqui nenhuma função calcula acesso, só pergunta ao banco e monta
 * o que a tela precisa. Quem escreve é o dono (ou colaborador com a permissão de Educação).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao, exigirPermissaoOuVisitante } from "@/lib/permissao.server";
import { lerTodas, lerTodasOuRecusar } from "@/lib/ler-todas";
import type { Database } from "@/integrations/supabase/types";

export const TIPOS = ["link", "pdf", "planilha", "imagem", "video", "audio", "outro"] as const;

/** Rótulo do tipo na tela — o valor cru em minúscula ficava feio no seletor. */
export const ROTULO_TIPO: Record<string, string> = {
  link: "Link", pdf: "PDF", planilha: "Planilha", imagem: "Imagem",
  video: "Vídeo", audio: "Áudio", outro: "Outro",
};

/** A ordem em que os formatos aparecem agrupados dentro da pasta. */
export const ORDEM_TIPOS = ["pdf", "planilha", "imagem", "video", "audio", "link", "outro"] as const;

const materialSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(1000).optional(),
  url: z.string().url().max(1000),
  kind: z.enum(TIPOS).default("link"),
  categoria: z.string().trim().max(80).optional(),
  capa_url: z.string().url().nullable().optional(),
  pasta_id: z.string().uuid().nullable().optional(),
  // A pessoa já sabe se clicou em "Enviar arquivo" ou colou um link — grava a
  // escolha em vez de reconstruir depois olhando o formato da URL.
  arquivo_proprio: z.boolean().default(false),
});

/**
 * Cria OU edita o material.
 *
 * Editar precisa existir por causa das pastas: sem isso, os materiais que já
 * estão na raiz ficariam presos lá para sempre — a única saída seria apagar e
 * recadastrar, perdendo o arquivo que já subiu para o bucket.
 */
export const salvarMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => materialSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const { id, ...campos } = data;
    const { ehUrlAssinadaNossa } = await import("@/lib/storage-assinado.server");
    let url = campos.url;
    let capaUrl = campos.capa_url ?? null;
    // Editar sem trocar o arquivo/capa reenvia o valor ASSINADO que a
    // listagem mostrou (é o que está no campo do formulário) — preserva o que
    // já estava gravado em vez de persistir um link que expira em minutos.
    if (id && (ehUrlAssinadaNossa(url) || ehUrlAssinadaNossa(capaUrl))) {
      const { data: atual } = await context.supabase
        .from("biblioteca_materiais").select("url, capa_url").eq("id", id).maybeSingle();
      if (ehUrlAssinadaNossa(url)) url = atual?.url ?? url;
      if (ehUrlAssinadaNossa(capaUrl)) capaUrl = atual?.capa_url ?? null;
    }
    const linha = {
      titulo: campos.titulo,
      descricao: campos.descricao?.trim() || null,
      url,
      kind: campos.kind,
      categoria: campos.categoria?.trim() || null,
      capa_url: capaUrl,
      pasta_id: campos.pasta_id ?? null,
      arquivo_proprio: campos.arquivo_proprio,
    };
    if (campos.pasta_id) await conferirPasta(context.supabase, campos.pasta_id);

    const q = id
      ? context.supabase.from("biblioteca_materiais").update(linha).eq("id", id)
      : context.supabase
          .from("biblioteca_materiais")
          .insert({ ...linha, mentor_id: context.userId });
    const { data: row, error } = await q.select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const excluirMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const { error } = await context.supabase
      .from("biblioteca_materiais").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** `.in()` em lotes: a lista de ids vai na URL (que tem limite), e cada lote fica longe do teto de linhas. */
function emLotes<T>(ids: T[], tamanho = 150): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < ids.length; i += tamanho) lotes.push(ids.slice(i, i + tamanho));
  return lotes;
}

/**
 * Confere que grupos e pessoas são da conta.
 *
 * A policy dos destinos só olha a PASTA/MATERIAL — o id vem do cliente e
 * passaria mesmo sendo de outra conta, enchendo a tabela de destino que nunca
 * casa e deixando a pasta "restrita para ninguém", sem sintoma na tela.
 */
async function validarDestinos(
  supabase: SupabaseClient<Database>, groupIds: string[], personIds: string[],
) {
  // Em lotes: a lista de ids vai na URL, e cada lote volta bem abaixo do teto de 1.000 linhas (#314).
  let achados = 0;
  for (const lote of emLotes([...new Set(groupIds)])) {
    const { data, error } = await supabase.from("groups").select("id").in("id", lote);
    if (error) throw new Error(error.message);
    achados += (data ?? []).length;
  }
  if (achados !== new Set(groupIds).size) throw new Error("Um dos grupos escolhidos não é seu.");
  achados = 0;
  for (const lote of emLotes([...new Set(personIds)])) {
    const { data, error } = await supabase.from("people").select("id").in("id", lote);
    if (error) throw new Error(error.message);
    achados += (data ?? []).length;
  }
  if (achados !== new Set(personIds).size) throw new Error("Uma das pessoas escolhidas não é sua.");
}

/** A pasta escolhida é da conta? O id vem do cliente. */
async function conferirPasta(supabase: SupabaseClient<Database>, pastaId: string) {
  const { data, error } = await supabase
    .from("biblioteca_pastas").select("id").eq("id", pastaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Essa pasta não é sua.");
}

/**
 * Banners do topo da Academy — item G, parte 2.
 *
 * Ficam no mesmo arquivo da biblioteca porque são a mesma ideia: curadoria do
 * master, consumo de todo mundo. Separar em outro módulo só criaria mais um
 * lugar para procurar.
 */
export const listarBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Banner em si não tem cadeado de conteúdo (é vitrine, sempre ativo=true),
    // mas ainda é parte da área Academy — mesma regra: sem 'educacao', o
    // colaborador não alcança nada daqui, nem isto.
    await exigirPermissaoOuVisitante(context.supabase, context.userId, "educacao");
    const { data, error } = await context.supabase
      .from("academy_banners")
      .select("id, imagem_url, link_url, titulo, ordem, ativo")
      .eq("ativo", true)
      .order("ordem");
    if (error) throw new Error(error.message);

    // Banner não tem trava de acesso (não é material de curso) — assina sempre,
    // sem checagem de liberado.
    const { assinarUrls, TTL_ARQUIVO_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const banners = data ?? [];
    const imagens = await assinarUrls(supabaseAdmin, banners.map((b) => b.imagem_url), TTL_ARQUIVO_SEGUNDOS);
    return { banners: banners.map((b, i) => ({ ...b, imagem_url: imagens[i] })) };
  });

export const salvarBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      imagem_url: z.string().url(),
      link_url: z.string().url().max(600).nullable().optional(),
      titulo: z.string().trim().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    // Entra no fim da fila. Reordenar é outra ação; criar já mexendo na ordem
    // dos outros seria surpresa.
    const { data: ultimo } = await context.supabase
      .from("academy_banners").select("ordem")
      .order("ordem", { ascending: false }).limit(1).maybeSingle();

    const { error } = await context.supabase.from("academy_banners").insert({
      mentor_id: context.userId,
      imagem_url: data.imagem_url,
      link_url: data.link_url ?? null,
      titulo: data.titulo?.trim() || null,
      ordem: (ultimo?.ordem ?? 0) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const { error } = await context.supabase
      .from("academy_banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moverBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), direcao: z.enum(["cima", "baixo"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const supabase = context.supabase;
    const { data: todos, error } = await supabase
      .from("academy_banners").select("id, ordem").order("ordem");
    if (error) throw new Error(error.message);

    const lista = todos ?? [];
    const i = lista.findIndex((b) => b.id === data.id);
    const j = data.direcao === "cima" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) return { ok: true };

    // Troca as posições dos dois vizinhos. Reescrever a lista inteira seria
    // mais simples de ler e mais fácil de embaralhar se duas abas mexerem ao
    // mesmo tempo.
    await Promise.all([
      supabase.from("academy_banners").update({ ordem: lista[j].ordem }).eq("id", lista[i].id),
      supabase.from("academy_banners").update({ ordem: lista[i].ordem }).eq("id", lista[j].id),
    ]);
    return { ok: true };
  });

// ============================================================================================
// #313 — A BIBLIOTECA COM MENU PRÓPRIO
// ============================================================================================
// Quem vê o quê é decidido num lugar só: `bib_decide`, no banco (migração 20260927120000). Estas
// funções só perguntam a ele (pelas portas `bib_visiveis`, `bib_pode_ver_material`, `bib_quem_ve`,
// `bib_resumo_acesso`) e montam a tela. Nenhuma filtra por conta própria.

const uuid = z.string().uuid();
const listaDeIds = z.array(uuid).max(500).default([]);

export type AcessoResumido = { veem: number; veemComLogin: number; bloqueados: number };
export type PastaDoAcervo = {
  id: string; titulo: string; descricao: string | null; capa_url: string | null;
  ordem: number; pasta_mae_id: string | null; created_at: string;
};
export type MaterialDoAcervo = {
  id: string; titulo: string; descricao: string | null; kind: string; categoria: string | null;
  capa_url: string | null; pasta_id: string | null; created_at: string;
};

async function assinarCapas<T extends { capa_url: string | null }>(itens: T[]): Promise<T[]> {
  const { assinarUrls, TTL_ARQUIVO_SEGUNDOS } = await import("@/lib/storage-assinado.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const capas = await assinarUrls(supabaseAdmin, itens.map((i) => i.capa_url), TTL_ARQUIVO_SEGUNDOS);
  return itens.map((i, k) => ({ ...i, capa_url: capas[k] }));
}

/**
 * A biblioteca inteira para a GESTÃO (dono e equipe com Academy), com o acesso de cada pasta e
 * material já resolvido pelo banco — "não liberado para ninguém" é `veem = 0`, nunca um palpite da tela.
 */
export const listarAcervo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await exigirPermissao(context.supabase, context.userId, "educacao");
    const s = context.supabase;
    // Tudo lido em partes até o fim (#314): a tela CONTA com estas linhas ("nenhum dos N materiais",
    // o selo de cada item) — uma fatia viraria número errado com cara de certo, então recusa.
    const [pastas, materiais, resumo, menu] = await Promise.all([
      lerTodasOuRecusar(
        (de, ate) => s.from("biblioteca_pastas")
          .select("id, titulo, descricao, capa_url, ordem, pasta_mae_id, created_at", { count: "exact" })
          .order("ordem").order("created_at").order("id").range(de, ate),
        "as pastas da Biblioteca",
      ),
      // `url` e `arquivo_proprio` só na gestão: editar sem trocar o arquivo reenvia o que está gravado.
      lerTodasOuRecusar(
        (de, ate) => s.from("biblioteca_materiais")
          .select("id, titulo, descricao, kind, categoria, capa_url, pasta_id, created_at, url, arquivo_proprio", { count: "exact" })
          .order("titulo").order("id").range(de, ate),
        "os materiais da Biblioteca",
      ),
      lerTodasOuRecusar(
        (de, ate) => s.rpc("bib_resumo_acesso", {}, { count: "exact" }).order("tipo").order("id").range(de, ate),
        "quem vê cada item da Biblioteca",
      ),
      lerTodasOuRecusar(
        (de, ate) => s.from("biblioteca_menu_grupos").select("group_id", { count: "exact" }).order("id").range(de, ate),
        "os grupos com o menu Biblioteca",
      ),
    ]);

    const acesso = new Map<string, AcessoResumido>();
    for (const r of resumo) {
      acesso.set(`${r.tipo}:${r.id}`, { veem: r.veem, veemComLogin: r.veem_com_login, bloqueados: r.bloqueados });
    }
    const nenhum: AcessoResumido = { veem: 0, veemComLogin: 0, bloqueados: 0 };
    let nomesDosGrupos: Array<{ id: string; name: string }> = [];
    try {
      nomesDosGrupos = (await lerTodas(
        (de, ate) => s.from("groups").select("id, name", { count: "exact" }).order("name").order("id").range(de, ate),
      )).linhas;
    } catch {
      // Quem da equipe não lê grupos fica só com a contagem (ver abaixo).
    }
    const ps = await assinarCapas(pastas as PastaDoAcervo[]);
    const ms = await assinarCapas(materiais as Array<MaterialDoAcervo & { url: string; arquivo_proprio: boolean }>);
    return {
      // Escrever é só do dono (a RLS da biblioteca exige mentor_id = auth.uid()); a equipe consulta.
      podeEditar: m.kind === "owner",
      pastas: ps.map((p) => ({ ...p, acesso: acesso.get(`pasta:${p.id}`) ?? nenhum })),
      materiais: ms.map((x) => ({ ...x, acesso: acesso.get(`material:${x.id}`) ?? nenhum })),
      menuGrupos: menu.map((r) => r.group_id),
      // Os nomes, para a tela dizer QUAIS grupos têm o menu. Quem da equipe não lê grupos fica só
      // com a contagem — não é motivo para derrubar a biblioteca inteira.
      grupos: nomesDosGrupos,
    };
  });

/**
 * O que ESTE login vê (ou, na prévia "ver como aluno", o que a pessoa `preview_person_id` vê). A
 * lista de ids sai de `bib_visiveis`, rodada com a sessão de quem pede; as linhas vêm pela chave de
 * serviço só desses ids. Material sai SEM link: o link só nasce no clique (`abrirMaterialDaBiblioteca`),
 * depois de o banco confirmar de novo.
 */
export const minhaBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ preview_person_id: uuid.nullable().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    // #226: para o banco, "equipe da conta" vê tudo — inclusive o colaborador SEM a permissão de
    // Educação. Dono, mentor e aluno passam; colaborador só com a permissão.
    await exigirPermissaoOuVisitante(context.supabase, context.userId, "educacao");
    // Em partes até o fim (#314): uma fatia esconderia material liberado sem ninguém saber.
    const vis = await lerTodasOuRecusar(
      (de, ate) => context.supabase
        .rpc("bib_visiveis", { _person_id: data.preview_person_id ?? null }, { count: "exact" })
        .order("tipo").order("id").range(de, ate),
      "a sua Biblioteca",
    );
    const idsPasta = vis.filter((v) => v.tipo === "pasta").map((v) => v.id);
    const idsMaterial = vis.filter((v) => v.tipo === "material").map((v) => v.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // As linhas, só desses ids, em lotes (a lista vai na URL).
    const pastasLidas: PastaDoAcervo[] = [];
    for (const lote of emLotes(idsPasta)) {
      const r = await supabaseAdmin.from("biblioteca_pastas")
        .select("id, titulo, descricao, capa_url, ordem, pasta_mae_id, created_at").in("id", lote);
      if (r.error) throw new Error(r.error.message);
      pastasLidas.push(...((r.data ?? []) as PastaDoAcervo[]));
    }
    const materiaisLidos: MaterialDoAcervo[] = [];
    for (const lote of emLotes(idsMaterial)) {
      const r = await supabaseAdmin.from("biblioteca_materiais")
        .select("id, titulo, descricao, kind, categoria, capa_url, pasta_id, created_at").in("id", lote);
      if (r.error) throw new Error(r.error.message);
      materiaisLidos.push(...((r.data ?? []) as MaterialDoAcervo[]));
    }
    materiaisLidos.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR") || a.id.localeCompare(b.id));
    const ms = await assinarCapas(materiaisLidos);
    return {
      pastas: await assinarCapas(pastasLidas),
      materiais: ms,
      categorias: [...new Set(ms.map((x) => x.categoria).filter(Boolean))].sort() as string[],
    };
  });

/**
 * O link de UM material, no momento do clique: o banco confere de novo (`bib_pode_ver_material`) e
 * só então o arquivo é assinado — um bloqueio feito depois de a página abrir já vale no clique
 * seguinte. Link externo volta como está (é o próprio conteúdo).
 */
export const abrirMaterialDaBiblioteca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissaoOuVisitante(context.supabase, context.userId, "educacao");
    const { data: pode, error } = await context.supabase.rpc("bib_pode_ver_material", { _material_id: data.id });
    if (error) throw new Error(error.message);
    if (pode !== true) throw new Error("Material não encontrado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m, error: e2 } = await supabaseAdmin
      .from("biblioteca_materiais").select("url").eq("id", data.id).maybeSingle();
    if (e2) throw new Error(e2.message);
    if (!m) throw new Error("Material não encontrado.");
    const { assinarUrls, TTL_ARQUIVO_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const [url] = await assinarUrls(supabaseAdmin, [m.url], TTL_ARQUIVO_SEGUNDOS);
    if (!url) throw new Error("Não foi possível abrir este material agora.");
    return { url };
  });

/** Criar ou editar pasta. Criar põe no fim da fila das irmãs; a pasta-mãe é conferida pelo banco. */
export const salvarPastaDoAcervo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid.optional(),
      titulo: z.string().trim().min(1).max(200),
      descricao: z.string().trim().max(1000).optional().nullable(),
      capa_url: z.string().url().nullable().optional(),
      pasta_mae_id: uuid.nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const s = context.supabase;
    const { ehUrlAssinadaNossa } = await import("@/lib/storage-assinado.server");
    let capaUrl = data.capa_url ?? null;
    if (data.id && ehUrlAssinadaNossa(capaUrl)) {
      const { data: atual } = await s.from("biblioteca_pastas").select("capa_url").eq("id", data.id).maybeSingle();
      capaUrl = atual?.capa_url ?? null;
    }
    const linha = { titulo: data.titulo, descricao: data.descricao?.trim() || null, capa_url: capaUrl };
    if (data.id) {
      const { data: row, error } = await s.from("biblioteca_pastas").update(linha).eq("id", data.id).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Pasta não encontrada.");
      return { id: row.id };
    }
    const mae = data.pasta_mae_id ?? null;
    const irmas = mae
      ? await s.from("biblioteca_pastas").select("ordem").eq("pasta_mae_id", mae).order("ordem", { ascending: false }).limit(1)
      : await s.from("biblioteca_pastas").select("ordem").is("pasta_mae_id", null).order("ordem", { ascending: false }).limit(1);
    if (irmas.error) throw new Error(irmas.error.message);
    const { data: row, error } = await s
      .from("biblioteca_pastas")
      .insert({ ...linha, mentor_id: context.userId, pasta_mae_id: mae, ordem: (irmas.data?.[0]?.ordem ?? 0) + 1 })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/**
 * Mover pasta para dentro de outra (ou para o início, com `pasta_mae_id` nulo). O limite de 3 níveis
 * e a trava contra ciclo são do banco — a mensagem dele chega aqui como está.
 */
export const moverPastaDoAcervo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, pasta_mae_id: uuid.nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const s = context.supabase;
    const irmas = data.pasta_mae_id
      ? await s.from("biblioteca_pastas").select("ordem").eq("pasta_mae_id", data.pasta_mae_id).order("ordem", { ascending: false }).limit(1)
      : await s.from("biblioteca_pastas").select("ordem").is("pasta_mae_id", null).order("ordem", { ascending: false }).limit(1);
    if (irmas.error) throw new Error(irmas.error.message);
    // Update que não atinge linha nenhuma volta SEM erro — por isso o .select() conferido.
    const { data: row, error } = await s
      .from("biblioteca_pastas")
      .update({ pasta_mae_id: data.pasta_mae_id, ordem: (irmas.data?.[0]?.ordem ?? 0) + 1 })
      .eq("id", data.id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Pasta não encontrada.");
    return { ok: true };
  });

/** Subir/descer uma pasta entre as irmãs (mesma pasta-mãe). */
export const reordenarPastaDoAcervo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, direcao: z.enum(["cima", "baixo"]) }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const s = context.supabase;
    const { data: esta, error: e0 } = await s.from("biblioteca_pastas").select("id, pasta_mae_id").eq("id", data.id).maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!esta) throw new Error("Pasta não encontrada.");
    // Renumera as irmãs — com uma fatia, a ordem sairia errada; lê todas (#314).
    const lista = await lerTodasOuRecusar(
      (de, ate) => {
        const q = s.from("biblioteca_pastas").select("id, ordem", { count: "exact" });
        return (esta.pasta_mae_id ? q.eq("pasta_mae_id", esta.pasta_mae_id) : q.is("pasta_mae_id", null))
          .order("ordem").order("created_at").order("id").range(de, ate);
      },
      "as pastas deste nível",
    );
    const i = lista.findIndex((p) => p.id === data.id);
    const j = data.direcao === "cima" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) return { ok: true };
    // Ordens iguais (pastas antigas) não trocam de lugar trocando o número: renumera as irmãs primeiro.
    const novas = lista.map((p, k) => ({ id: p.id, ordem: k + 1 }));
    [novas[i].ordem, novas[j].ordem] = [novas[j].ordem, novas[i].ordem];
    for (const p of novas) {
      const { error } = await s.from("biblioteca_pastas").update({ ordem: p.ordem }).eq("id", p.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Mover material para uma pasta (ou para o início da Biblioteca, com `pasta_id` nulo). */
export const moverMaterialDoAcervo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, pasta_id: uuid.nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    if (data.pasta_id) await conferirPasta(context.supabase, data.pasta_id);
    const { data: row, error } = await context.supabase
      .from("biblioteca_materiais").update({ pasta_id: data.pasta_id }).eq("id", data.id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Material não encontrado.");
    return { ok: true };
  });

/**
 * Apagar pasta pelo banco (`bib_apagar_pasta`): o conteúdo sobe um nível e continua visível EXATAMENTE
 * para quem via — as regras da pasta passam para cada item. Nenhum material é apagado.
 */
export const apagarPastaDoAcervo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const { data: r, error } = await context.supabase.rpc("bib_apagar_pasta", { _pasta_id: data.id });
    if (error) throw new Error(error.message);
    return r as { materiais: number; subpastas: number; para: string | null };
  });

/** As regras de UMA pasta ou material: quem foi liberado e quem foi bloqueado ali. */
export const lerRegrasDaBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ alvo: z.enum(["pasta", "material"]), id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const s = context.supabase;
    const [lib, bloq] = data.alvo === "pasta"
      ? await Promise.all([
          lerTodasOuRecusar((de, ate) => s.from("biblioteca_pasta_destinos").select("group_id, person_id", { count: "exact" })
            .eq("pasta_id", data.id).order("id").range(de, ate), "as liberações desta pasta"),
          lerTodasOuRecusar((de, ate) => s.from("biblioteca_pasta_bloqueios").select("group_id, person_id", { count: "exact" })
            .eq("pasta_id", data.id).order("id").range(de, ate), "os bloqueios desta pasta"),
        ])
      : await Promise.all([
          lerTodasOuRecusar((de, ate) => s.from("biblioteca_material_destinos").select("group_id, person_id", { count: "exact" })
            .eq("material_id", data.id).order("id").range(de, ate), "as liberações deste material"),
          lerTodasOuRecusar((de, ate) => s.from("biblioteca_material_bloqueios").select("group_id, person_id", { count: "exact" })
            .eq("material_id", data.id).order("id").range(de, ate), "os bloqueios deste material"),
        ]);
    const separar = (rows: Array<{ group_id: string | null; person_id: string | null }>) => ({
      grupos: rows.filter((r) => r.group_id).map((r) => r.group_id as string),
      pessoas: rows.filter((r) => r.person_id).map((r) => r.person_id as string),
    });
    return { liberados: separar(lib), bloqueados: separar(bloq) };
  });

const conjunto = z.object({ grupos: listaDeIds, pessoas: listaDeIds });

/**
 * Grava as regras de uma pasta ou material por DIFERENÇA, e na ordem que nunca abre nada no meio do
 * caminho: primeiro o que RESTRINGE (bloqueios novos, liberações retiradas), depois o que LIBERA
 * (bloqueios retirados, liberações novas). A mesma pessoa/grupo não pode estar liberada e bloqueada
 * no mesmo lugar — a negação venceria, e a tela estaria mostrando uma liberação que não vale.
 */
export const salvarRegrasDaBiblioteca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ alvo: z.enum(["pasta", "material"]), id: uuid, liberados: conjunto, bloqueados: conjunto }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const s = context.supabase;
    const g = (ids: string[]) => ids.map((x) => `g:${x}`);
    const p = (ids: string[]) => ids.map((x) => `p:${x}`);
    const querLib = new Set([...g(data.liberados.grupos), ...p(data.liberados.pessoas)]);
    const querBloq = new Set([...g(data.bloqueados.grupos), ...p(data.bloqueados.pessoas)]);
    if ([...querLib].some((k) => querBloq.has(k))) {
      throw new Error("A mesma pessoa ou grupo não pode estar liberado e bloqueado no mesmo lugar.");
    }
    await validarDestinos(s, [...data.liberados.grupos, ...data.bloqueados.grupos], [...data.liberados.pessoas, ...data.bloqueados.pessoas]);

    const ehPasta = data.alvo === "pasta";
    // O que já existe, inteiro (#314): a troca é por diferença — uma fatia faria regra existente
    // parecer ausente (e ser inserida de novo) ou nunca ser retirada.
    const [libAtual, bloqAtual] = ehPasta
      ? await Promise.all([
          lerTodasOuRecusar((de, ate) => s.from("biblioteca_pasta_destinos").select("id, group_id, person_id", { count: "exact" })
            .eq("pasta_id", data.id).order("id").range(de, ate), "as liberações desta pasta"),
          lerTodasOuRecusar((de, ate) => s.from("biblioteca_pasta_bloqueios").select("id, group_id, person_id", { count: "exact" })
            .eq("pasta_id", data.id).order("id").range(de, ate), "os bloqueios desta pasta"),
        ])
      : await Promise.all([
          lerTodasOuRecusar((de, ate) => s.from("biblioteca_material_destinos").select("id, group_id, person_id", { count: "exact" })
            .eq("material_id", data.id).order("id").range(de, ate), "as liberações deste material"),
          lerTodasOuRecusar((de, ate) => s.from("biblioteca_material_bloqueios").select("id, group_id, person_id", { count: "exact" })
            .eq("material_id", data.id).order("id").range(de, ate), "os bloqueios deste material"),
        ]);
    const chave = (r: { group_id: string | null; person_id: string | null }) => (r.group_id ? `g:${r.group_id}` : `p:${r.person_id}`);
    const temLib = new Map(libAtual.map((r) => [chave(r), r.id]));
    const temBloq = new Map(bloqAtual.map((r) => [chave(r), r.id]));
    const grupo = (k: string) => (k.startsWith("g:") ? k.slice(2) : null);
    const pessoa = (k: string) => (k.startsWith("p:") ? k.slice(2) : null);

    // 1. RESTRINGE: bloqueios novos…
    const bloqNovos = [...querBloq].filter((k) => !temBloq.has(k));
    if (bloqNovos.length) {
      const r = ehPasta
        ? await s.from("biblioteca_pasta_bloqueios").insert(bloqNovos.map((k) => ({ pasta_id: data.id, group_id: grupo(k), person_id: pessoa(k) })))
        : await s.from("biblioteca_material_bloqueios").insert(bloqNovos.map((k) => ({ material_id: data.id, group_id: grupo(k), person_id: pessoa(k) })));
      if (r.error) throw new Error(r.error.message);
    }
    // … e liberações retiradas.
    const libSaindo = [...temLib.entries()].filter(([k]) => !querLib.has(k)).map(([, id]) => id);
    for (const lote of emLotes(libSaindo)) {
      const r = ehPasta
        ? await s.from("biblioteca_pasta_destinos").delete().in("id", lote)
        : await s.from("biblioteca_material_destinos").delete().in("id", lote);
      if (r.error) throw new Error(r.error.message);
    }
    // 2. LIBERA: bloqueios retirados…
    const bloqSaindo = [...temBloq.entries()].filter(([k]) => !querBloq.has(k)).map(([, id]) => id);
    for (const lote of emLotes(bloqSaindo)) {
      const r = ehPasta
        ? await s.from("biblioteca_pasta_bloqueios").delete().in("id", lote)
        : await s.from("biblioteca_material_bloqueios").delete().in("id", lote);
      if (r.error) throw new Error(r.error.message);
    }
    // … e liberações novas.
    const libNovas = [...querLib].filter((k) => !temLib.has(k));
    if (libNovas.length) {
      const r = ehPasta
        ? await s.from("biblioteca_pasta_destinos").insert(libNovas.map((k) => ({ pasta_id: data.id, group_id: grupo(k), person_id: pessoa(k) })))
        : await s.from("biblioteca_material_destinos").insert(libNovas.map((k) => ({ material_id: data.id, group_id: grupo(k), person_id: pessoa(k) })));
      if (r.error) throw new Error(r.error.message);
    }
    return { ok: true };
  });

/** Os grupos com o menu Biblioteca (camada 1). Troca por diferença; tirar primeiro, pôr depois. */
export const salvarMenuDaBiblioteca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ grupos: listaDeIds }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const s = context.supabase;
    await validarDestinos(s, data.grupos, []);
    const atuais = await lerTodasOuRecusar(
      (de, ate) => s.from("biblioteca_menu_grupos").select("id, group_id", { count: "exact" }).order("id").range(de, ate),
      "os grupos com o menu Biblioteca",
    );
    const quero = new Set(data.grupos);
    const saindo = atuais.filter((r) => !quero.has(r.group_id)).map((r) => r.id);
    for (const lote of emLotes(saindo)) {
      const r = await s.from("biblioteca_menu_grupos").delete().in("id", lote);
      if (r.error) throw new Error(r.error.message);
    }
    const tem = new Set(atuais.map((r) => r.group_id));
    const novos = data.grupos.filter((gid) => !tem.has(gid));
    if (novos.length) {
      const r = await s.from("biblioteca_menu_grupos").insert(novos.map((gid) => ({ group_id: gid })));
      if (r.error) throw new Error(r.error.message);
    }
    return { ok: true };
  });

/**
 * O menu Biblioteca de UM grupo só (#315) — a mesma tabela e a mesma regra de `salvarMenuDaBiblioteca`,
 * chamada da ficha do grupo (aba Acesso), que só conhece este grupo. Liga = insere; desliga = apaga a
 * linha; nenhuma outra linha muda. A permissão continua "educacao" (a mesma da tela própria da
 * Biblioteca) — a ficha do grupo passa a MOSTRAR o controle, não a abrir uma capacidade nova: quem só
 * tem "grupos" vê a caixa, e o clique falha com o mesmo aviso de sempre se faltar "educacao".
 */
export const definirMenuBibliotecaDoGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ group_id: uuid, ligado: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const s = context.supabase;
    await validarDestinos(s, [data.group_id], []);
    if (data.ligado) {
      const r = await s.from("biblioteca_menu_grupos").upsert({ group_id: data.group_id }, { onConflict: "group_id" });
      if (r.error) throw new Error(r.error.message);
    } else {
      const r = await s.from("biblioteca_menu_grupos").delete().eq("group_id", data.group_id);
      if (r.error) throw new Error(r.error.message);
    }
    return { ok: true };
  });

/** "Quem vê isto": a lista final, pessoa a pessoa, com o motivo — calculada pelo banco. */
export const quemVeNaBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ alvo: z.enum(["pasta", "material"]), id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    // Uma linha por pessoa da conta — cresce com a conta, então em partes até o fim (#314).
    const pessoas = await lerTodasOuRecusar(
      (de, ate) => context.supabase
        .rpc("bib_quem_ve", {
          _pasta_id: data.alvo === "pasta" ? data.id : null,
          _material_id: data.alvo === "material" ? data.id : null,
        }, { count: "exact" })
        .order("nome").order("person_id").range(de, ate),
      "quem vê este item",
    );
    return { pessoas };
  });
