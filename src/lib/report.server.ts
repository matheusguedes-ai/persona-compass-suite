/**
 * Construção do relatório comportamental — compartilhada entre o relatório
 * individual (/api/public/report/$id) e o unificado da bateria
 * (/api/public/report-bateria/$id).
 */
import { computeDerived, type DerivedConfig, type FactorMap } from "@/lib/derivations";
import { loadBrandAndSettings } from "@/lib/brand.server";
import { usaMotorIpsativo, type ResultadoIpsativo } from "@/lib/escolha-forcada";
import { montarIntensidade } from "@/lib/intensidade";
import { obterIpsativo } from "@/lib/ipsativo.server";
import { getRequest } from "@tanstack/react-start/server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Esta pessoa pode ser vista por quem está pedindo o relatório agora?
 *
 * `/relatorio/$id` é uma rota PÚBLICA de propósito: o avaliado recebe o link
 * por e-mail e nunca precisa criar conta para ver o próprio resultado — o
 * UUID da resposta É o token de acesso. Isso é correto e não muda aqui.
 *
 * O furo era outro: essa MESMA rota pública é a que a tela autenticada do
 * mentor abre ao clicar em "Relatório" (`/_app/envios` → `/relatorio/$id`).
 * Só que `buildReport` usa service role e nunca olhava para quem estava
 * pedindo — então um mentor convidado, logado, trocando o UUID na barra de
 * endereço, enxergava resposta de gente fora dos grupos dele. A fronteira de
 * grupo (`can_see_person`) só existe nas policies das TABELAS; este caminho
 * nunca passava por elas.
 *
 * SEM Authorization: sem sessão nenhuma — é o link público de sempre,
 * comportamento inalterado.
 * COM Authorization: alguém está logado, e a pergunta vira "esta sessão
 * consegue ler esta pessoa pela RLS de sempre?" — verificado com o cliente do
 * PRÓPRIO usuário, contra a tabela `people`. Não reimplemento a regra aqui:
 * a policy de `people` já é `(mentor_id = acting_account()) AND
 * can_see_person(id)) OR (user_id = auth.uid())`, que cobre dono, colaborador,
 * mentor com o grupo certo E o próprio aluno vendo o seu resultado — de graça,
 * pela mesma fonte de verdade que o resto da plataforma usa.
 *
 * Token ausente ou inválido no header: nega. Não é "decide na dúvida" — é
 * "sessão que alega existir e não prova, não prova nada".
 */
export async function podeVerPessoaAutenticado(personId: string | null | undefined): Promise<boolean> {
  if (!personId) return true;
  const authHeader = getRequest()?.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return true;
  const token = authHeader.slice(7).trim();
  if (!token) return true;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return false;

    const escopado = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await escopado.from("people").select("id").eq("id", personId).maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

export type NormMap = Record<string, { natural: number; adaptado: number }>;

export function formatDuration(startIso: string | null, endIso: string | null): string | null {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return "menos de 1 minuto";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/** Eixos do MBTI: par de keys de dimensão [polo A, polo B]. */
const MBTI_AXES: Array<[string, string, string, string]> = [
  ["E", "I", "Extroversão", "Introversão"],
  ["S", "N", "Sensação", "Intuição"],
  ["T", "F", "Pensamento", "Sentimento"],
  ["J", "P", "Julgamento", "Percepção"],
];

/** Detecta se as dimensões correspondem ao inventário MBTI (8 polos). */
export function isMbtiDims(keys: string[]): boolean {
  const set = new Set(keys.map((k) => k.trim().toUpperCase()));
  return MBTI_AXES.every(([a, b]) => set.has(a) && set.has(b));
}

/** Monta o tipo MBTI real a partir dos escores brutos por polo. */
export function buildMbtiFromFactors(
  factors: Array<{ key: string; label: string; natural: number; natural_norm: number }>,
) {
  const byKey = new Map(factors.map((f) => [f.key.trim().toUpperCase(), f]));
  const pares: Array<{ left: string; right: string; leftPct: number; rightPct: number; preferred: string }> = [];
  let tipo = "";
  for (const [aKey, bKey, aLabel, bLabel] of MBTI_AXES) {
    const a = byKey.get(aKey);
    const b = byKey.get(bKey);
    if (!a || !b) return null;
    const total = (a.natural ?? 0) + (b.natural ?? 0);
    const aPct = total > 0 ? Math.round(((a.natural ?? 0) / total) * 1000) / 10 : 50;
    const bPct = Math.round((100 - aPct) * 10) / 10;
    const preferA = aPct >= 50;
    tipo += preferA ? aKey : bKey;
    pares.push({
      left: a.label || aLabel,
      right: b.label || bLabel,
      leftPct: aPct,
      rightPct: bPct,
      preferred: preferA ? a.label || aLabel : b.label || bLabel,
    });
  }
  return { tipo, pares };
}

export type BuiltReport = Awaited<ReturnType<typeof buildReport>>;

/**
 * Coloca as dimensões na ordem do ranking do motor (#288 Etapa 2b-i). O relatório não decide
 * mais quem é o 1º, o 2º… — só obedece a ordem que veio gravada (desempate já resolvido lá, pela
 * ordem da letra no instrumento).
 */
function ordenarPeloRanking<T extends { key: string }>(lista: T[], ranking: string[]): T[] {
  const posicao = new Map(ranking.map((k, i) => [k, i]));
  return [...lista].sort((a, b) => (posicao.get(a.key) ?? ranking.length) - (posicao.get(b.key) ?? ranking.length));
}

export async function buildReport(id: string) {
  const supabase = await getAdmin();
  const { data: response } = await supabase
    .from("test_responses")
    .select(
      "id, submitted_at, started_at, computed_scores, version_id, mentor_id, person_id, people(full_name), test_versions(title, description, derived_config, instrument_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!response || !response.submitted_at) {
    return { status: 404 as const, error: "Relatório indisponível: o teste ainda não foi concluído." };
  }

  if (!(await podeVerPessoaAutenticado(response.person_id))) {
    return { status: 404 as const, error: "Você não tem acesso a este relatório." };
  }

  const computed = (response.computed_scores ?? {}) as {
    natural?: Record<string, number>;
    adaptado?: Record<string, number>;
    normalized?: NormMap;
    qualidade?: {
      nivel: "alta" | "media" | "baixa";
      motivos: string[];
      consistencia: number | null;
      variacao: number | null;
      contradicoes?: number | null;
      posicao_repetida?: number | null;
      segundos_por_item: number | null;
    };
  };
  const instrumentId = response.test_versions?.instrument_id ?? null;
  const versionId = response.version_id;

  // FONTE DOS NÚMEROS (#288 Etapas 2b-i e 2c).
  //
  // DISC, Temperamentos e VAK: o relatório lê a fonte única do motor (`computed_scores.ipsativo`,
  // ou o mesmo resultado derivado das respostas cruas quando a resposta é anterior à 2a) e NÃO lê
  // mais `natural`/`adaptado`/`normalized`. Os demais instrumentos (Valores, Big Five, MBTI, QI,
  // testes personalizados) não passam pelo motor ipsativo e seguem lendo o formato antigo.
  const fonteIpsativa = usaMotorIpsativo(instrumentId);
  if (!fonteIpsativa && (!computed.normalized || Object.keys(computed.normalized).length === 0)) {
    return { status: 404 as const, error: "Este teste não gera relatório comportamental detalhado." };
  }

  const [dimsRes, bandsRes, contentRes] = await Promise.all([
    supabase.from("test_dimensions").select("id, key, label, color, sort_order").eq("version_id", versionId).order("sort_order"),
    supabase.from("test_result_bands").select("id, dimension_id, mode, min_score, max_score, title, description").eq("version_id", versionId),
    supabase
      .from("report_content")
      .select("section, dimension_key, mode, band_min, band_max, title, body, sort_order, version_id, status")
      .or(`version_id.is.null,version_id.eq.${versionId}`)
      .order("sort_order"),
  ]);
  if (dimsRes.error) throw new Error(dimsRes.error.message);
  if (bandsRes.error) throw new Error(bandsRes.error.message);
  if (contentRes.error) throw new Error(contentRes.error.message);
  const dims = dimsRes.data;
  const bands = bandsRes.data;
  const content = contentRes.data;

  let ips: ResultadoIpsativo | null = null;
  if (fonteIpsativa) {
    const obtido = await obterIpsativo(supabase, {
      responseId: id,
      versionId,
      computedScores: response.computed_scores,
    });
    if (!obtido) {
      return { status: 404 as const, error: "Este teste não gera relatório comportamental detalhado." };
    }
    ips = obtido.ipsativo;
  }
  /**
   * Leituras por fator (faixas, descritores, derivações, 360°, seções por dimensão). Com o motor
   * ipsativo, seguem o ranking do conjunto ADAPTADO — o mesmo número de sempre (vezes MAIS ÷ soma).
   * O PERFIL declarado é outra coisa: é o do NATURAL (ver `perfilNatural` abaixo).
   * `null` fora do motor ipsativo.
   */
  const rankingDoMotor: string[] | null = ips ? ips.adaptado.ranking : null;
  const letraPorDim = new Map((ips?.letras ?? []).map((l) => [l.dimension_id, l]));
  const normalized = (computed.normalized ?? {}) as NormMap;

  // A ordem dos campos é a de sempre: o relatório dos instrumentos fora do motor tem de sair
  // idêntico, byte a byte.
  const dimList = (dims ?? []).map((d) => {
    if (ips) {
      const l = letraPorDim.get(d.id);
      return {
        id: d.id,
        key: d.key,
        label: d.label,
        color: d.color ?? null,
        has_data: l != null,
        // Nome herdado do formato antigo, que chamava de "natural" o número das vezes MAIS. Na
        // linguagem do motor (Etapa 2a) esse número é o do conjunto ADAPTADO — é ele que as leituras
        // por fator sempre usaram. O gráfico NATURAL de verdade está em `intensidade.natural`.
        natural: l?.adaptado.bruto ?? 0,
        // Não existe mais um "adaptado" na mesma régua do número abaixo (Etapa 2c: a ponte morreu).
        adaptado: null as number | null,
        natural_norm: l?.adaptado.percentual ?? 0,
        adaptado_norm: null as number | null,
      };
    }
    const norm = normalized[d.id];
    return {
      id: d.id,
      key: d.key,
      label: d.label,
      color: d.color ?? null,
      // Ausente de `normalized` = nenhuma pergunta pontua esta dimensão.
      // É falta de dado, não resultado zero — não pode virar "faixa baixa".
      has_data: norm != null,
      natural: computed.natural?.[d.id] ?? 0,
      adaptado: (computed.adaptado?.[d.id] ?? 0) as number | null,
      natural_norm: norm?.natural ?? 0,
      adaptado_norm: (norm?.adaptado ?? 0) as number | null,
    };
  });

  // DISC quando o conjunto de keys das dimensões é exatamente {D,I,S,C}.
  const keySet = new Set(dimList.map((d) => d.key.trim().toUpperCase()));
  const isDisc = keySet.size === 4 && ["D", "I", "S", "C"].every((k) => keySet.has(k));
  const isMbti = isMbtiDims(dimList.map((d) => d.key));

  // Dimensões medidas, na ordem das leituras por fator. Com a fonte única, quem manda na ordem é o
  // RANKING que o motor gravou — o relatório não reordena por conta própria. Fora do motor ipsativo,
  // ordena por natural_norm como sempre.
  const ranked = rankingDoMotor
    ? ordenarPeloRanking(dimList.filter((d) => d.has_data), rankingDoMotor)
    : dimList.filter((d) => d.has_data).sort((a, b) => b.natural_norm - a.natural_norm);
  const above = ranked.filter((d) => d.natural_norm >= 50).slice(0, 2);
  /**
   * PERFIL DECLARADO. Com o motor ipsativo (Etapa 2c) é a sigla do gráfico NATURAL que o motor
   * gravou — uma letra, ou duas na ordem do ranking quando é perfil combinado —, como na referência
   * que o dono do produto usa ("PERFIL CI" é a sigla do natural; o adaptado tem a dele). Fora do
   * motor, a regra de sempre: até duas letras a partir de 50.
   */
  const perfilNatural = ips?.natural.perfil ?? null;
  const profileDims = perfilNatural
    ? perfilNatural.chaves
        .map((k) => dimList.find((d) => d.key === k))
        .filter((d): d is (typeof dimList)[number] => d != null)
    : above.length > 0
      ? above
      : ranked.slice(0, 1);
  const profile = perfilNatural ? perfilNatural.codigo : profileDims.map((d) => d.key).join("");

  /**
   * Resultado achatado não tem perfil, e dizer que tem é mentira.
   *
   * Quando todas as dimensões ficam praticamente empatadas, a ordenação acima
   * ainda elege uma "primeira" — e o relatório saía cravando "Perfil D" para
   * quem tinha 25 em D, I, S e C. O empate vinha do desempate da lista, não da
   * pessoa. Dez pontos numa escala de 0 a 100 é pouco demais para separar:
   * abaixo disso o relatório passa a dizer que não há predominância, e as
   * seções escritas para um perfil específico saem de cena — as leituras por
   * dimensão continuam, porque essas são o dado de verdade.
   *
   * Com o motor ipsativo vale a regra dele, por decisão do dono do produto: EMPATE MÚLTIPLO no
   * gráfico natural (três ou mais letras a até 2 pontos da primeira) é "sem predominância clara" —
   * e também quando nenhuma letra tem sinal suficiente para ocupar o título (#292).
   */
  const amplitude = ranked.length > 1
    ? ranked[0].natural_norm - ranked[ranked.length - 1].natural_norm
    : 100;
  const perfilIndefinido = perfilNatural
    ? perfilNatural.empate_multiplo || perfilNatural.tipo === "sem_sinal"
    : ranked.length > 1 && amplitude < 10;

  // Prefer version-specific content over global fallback. Texto marcado como pendente não aparece.
  const rows = (content ?? []).filter((r) => r.status !== "pendente");
  const pick = (section: string, key: string, mode?: string) => {
    const candidates = rows.filter(
      (r) => r.section === section && r.dimension_key === key && (mode ? r.mode === mode : true),
    );
    const specific = candidates.filter((r) => r.version_id === versionId);
    const list = specific.length > 0 ? specific : candidates;
    return list[0] ?? null;
  };

  const COMPOSITE_SECTIONS = [
    "sintese",
    "potencialidades",
    "relacoes",
    "decisao",
    "motivador",
    "medos",
    "adequacao",
    "pontos_desenvolver",
  ] as const;

  // Conteúdo por faixa: casa o escore normalizado com band_min/band_max da dimensão.
  const pickBand = (section: string, key: string, score: number) => {
    const candidates = rows.filter(
      (r) =>
        r.section === section &&
        r.dimension_key === key &&
        r.band_min != null &&
        r.band_max != null &&
        score >= Number(r.band_min) &&
        score <= Number(r.band_max),
    );
    const specific = candidates.filter((r) => r.version_id === versionId);
    return (specific.length > 0 ? specific : candidates)[0] ?? null;
  };

  /**
   * Instrumentos dimensionais (Big Five, Valores, VAK…) não têm "tipo" como o
   * DISC. As seções compostas são montadas a partir das dimensões efetivamente
   * medidas: cada trecho vem da faixa real daquela dimensão, nunca de um perfil
   * presumido. Conteúdo vive em `report_content` como `<instrumento>_<seção>`.
   */
  /**
   * MBTI: a narrativa sai dos EIXOS, não do rótulo de quatro letras.
   *
   * O que o inventário mede são quatro preferências independentes. O tipo
   * "ENFJ" é um apelido para o conjunto delas — e um apelido que engana quando
   * algum eixo ficou em 52% contra 48%, porque a letra vira sorteio. Então:
   * a síntese usa o tipo, mas todo o resto é lido eixo a eixo, e o eixo
   * indeciso é declarado como indeciso em vez de virar letra.
   */
  const mbtiSections = () => {
    const built = buildMbtiFromFactors(dimList.filter((d) => d.has_data));
    if (!built) return [];
    const out: Array<{ section: string; title: string | null; body: string }> = [];

    // Polo escolhido em cada eixo, marcando os que ficaram no muro.
    const polos = MBTI_AXES.map(([a, b], i) => {
      const d = built.pares[i];
      if (!d) return null;
      const forte = Math.max(d.leftPct, d.rightPct);
      return { polo: d.leftPct >= 50 ? a : b, oposto: d.leftPct >= 50 ? b : a, indeciso: forte < 55 };
    }).filter((p): p is { polo: string; oposto: string; indeciso: boolean } => p != null);

    /**
     * A síntese por tipo só entra quando o tipo significa alguma coisa.
     *
     * Com um eixo empatado, "ENTJ" e "ENFJ" são o mesmo resultado — escolher um
     * dos dois para descrever a pessoa é decidir na moeda e depois falar com
     * convicção. Então: eixo todo definido, síntese normal; um eixo no muro, as
     * duas leituras possíveis, ditas como duas; dois ou mais no muro, nenhuma —
     * aí o tipo não passa de um sorteio de quatro letras.
     */
    const indecisos = polos.filter((p) => p.indeciso);
    if (indecisos.length === 0) {
      const sintese = pick("mbti_sintese", built.tipo);
      if (sintese?.body) out.push({ section: "sintese", title: sintese.title, body: sintese.body });
    } else if (indecisos.length === 1) {
      const alternativo = polos.map((p) => (p.indeciso ? p.oposto : p.polo)).join("");
      const a = pick("mbti_sintese", built.tipo);
      const b = pick("mbti_sintese", alternativo);
      if (a?.body && b?.body) {
        out.push({
          section: "sintese",
          title: `Seu resultado fica entre ${built.tipo} e ${alternativo}`,
          body:
            `Um dos quatro eixos ficou praticamente empatado, então as duas leituras abaixo se ` +
            `aplicam a você. Veja qual das duas descreve melhor o seu dia a dia — e note que ` +
            `transitar entre elas conforme a situação também é uma resposta.\n\n` +
            `**${built.tipo}.** ${a.body}\n\n**${alternativo}.** ${b.body}`,
        });
      }
    }

    const juntar = (suffix: string, titulo: string) => {
      const corpo = polos
        .filter((p) => !p.indeciso) // eixo no muro não gera afirmação
        .map((p) => pick(`mbti_${suffix}`, p.polo)?.body ?? null)
        .filter((s): s is string => s != null)
        .join("\n\n");
      if (corpo) out.push({ section: suffix, title: titulo, body: corpo });
    };
    juntar("eixo", "O que cada preferência sua quer dizer");
    juntar("trabalho", "Como isso aparece no trabalho");
    juntar("relacoes", "Como isso aparece nas relações");
    juntar("atencao", "Pontos cegos de cada preferência");

    if (indecisos.length > 0) {
      out.push({
        section: "pontos_desenvolver",
        title: "Preferências que ficaram no meio",
        body:
          `Em ${indecisos.length === 1 ? "um dos eixos" : `${indecisos.length} eixos`} suas respostas ficaram ` +
          "quase empatadas. Isso não é erro nem indecisão: quer dizer que você transita pelos dois lados " +
          "conforme a situação, e que a letra correspondente do seu tipo não deve ser levada a sério. " +
          "Leia as outras preferências, que essas sim apareceram com clareza.",
      });
    }
    return out;
  };

  const dimensionalSections = () => {
    if (!instrumentId) return [];
    const measured = dimList.filter((d) => d.has_data);
    if (measured.length === 0) return [];
    const out: Array<{ section: string; title: string | null; body: string }> = [];

    const porRanking = <T extends { key: string; natural_norm: number }>(lista: T[]) =>
      rankingDoMotor ? ordenarPeloRanking(lista, rankingDoMotor) : [...lista].sort((a, b) => b.natural_norm - a.natural_norm);
    const top = porRanking(measured)[0];
    // Só afirma um traço dominante quando ele realmente se destaca.
    const sintese =
      top.natural_norm >= 60
        ? pick(`${instrumentId}_sintese`, top.key)
        : pick(`${instrumentId}_sintese`, "equilibrado");
    if (sintese?.body) out.push({ section: "sintese", title: sintese.title, body: sintese.body });

    const aggregate = (suffix: string) =>
      measured
        .map((d) => {
          const block = pickBand(`${instrumentId}_${suffix}`, d.key, d.natural_norm);
          return block?.body ? `${d.label}: ${block.body}` : null;
        })
        .filter((s): s is string => s != null)
        .join("\n\n");

    /**
     * Seções escritas para a dimensão, não para a faixa.
     *
     * As de cima (`forca`, `atencao`) percorrem TODAS as dimensões e escolhem o
     * texto pela faixa em que a pessoa caiu. Estas aqui são outra coisa: leituras
     * mais longas do que se destacou. Percorrer as seis dimensões de Valores em
     * quatro seções daria 24 parágrafos — o leitor desiste antes da metade, e o
     * que é relevante fica enterrado no que não é.
     *
     * Então: as duas dimensões mais altas, e só quando realmente se destacam.
     * Empate geral não gera afirmação nenhuma — vale a mesma regra do DISC.
     */
    const ordenadas = porRanking(measured);
    const amplitudeDim = ordenadas.length > 1
      ? ordenadas[0].natural_norm - ordenadas[ordenadas.length - 1].natural_norm
      : 100;
    const destacadas = amplitudeDim >= 10 ? ordenadas.slice(0, 2) : [];

    const juntar = (suffix: string, titulo: string, dims: typeof ordenadas) => {
      const corpo = dims
        .map((d) => pick(`${instrumentId}_${suffix}`, d.key)?.body ?? null)
        .filter((s): s is string => s != null)
        .join("\n\n");
      if (corpo) out.push({ section: suffix, title: titulo, body: corpo });
    };

    juntar("perfil", "O que mais pesa em você", destacadas);

    const forcas = aggregate("forca");
    if (forcas) out.push({ section: "potencialidades", title: "Potencialidades", body: forcas });

    juntar("trabalho", "Como isso aparece no trabalho", destacadas);
    juntar("relacoes", "Como isso aparece nas relações", destacadas);
    juntar("pressao", "Como você fica sob pressão", destacadas.slice(0, 1));

    // A dimensão mais baixa costuma explicar tanto quanto a mais alta — e é a
    // que ninguém olha, porque relatório de perfil só fala do que se destaca.
    const ultima = ordenadas[ordenadas.length - 1];
    if (destacadas.length > 0 && ultima) {
      const sombra = pick(`${instrumentId}_sombra`, ultima.key);
      if (sombra?.body) {
        out.push({ section: "sombra", title: "O que menos aparece em você", body: sombra.body });
      }
    }

    const atencao = aggregate("atencao");
    if (atencao) {
      out.push({ section: "pontos_desenvolver", title: "Pontos de atenção e desenvolvimento", body: atencao });
    }

    juntar("desenvolvimento", "Por onde começar", destacadas.slice(0, 1));

    if (destacadas.length === 0 && ordenadas.length > 1) {
      out.push({
        section: "equilibrio",
        title: "Nenhuma dimensão se destacou",
        body:
          "Suas respostas distribuíram peso quase igual entre todas as dimensões. Isso pode significar " +
          "duas coisas bem diferentes: que você de fato transita entre elas conforme a situação, ou que " +
          "o inventário foi respondido sem muita diferenciação. As leituras por dimensão continuam " +
          "válidas — o que não dá para afirmar aqui é uma predominância.",
      });
    }
    return out;
  };

  // Seções escritas por perfil (DISC). Com o motor ipsativo, pela letra que LIDERA a sigla natural:
  // os textos de combinação destas seções (CI, DS…) nunca foram revisados pelo dono do produto, e a
  // descrição do perfil combinado é a da página de intensidade (`intensidade.texto`).
  const chaveDasSecoes = perfilNatural ? perfilNatural.chaves[0] : null;
  const sections = isDisc && !perfilIndefinido
    ? COMPOSITE_SECTIONS.map((section) => {
        const block = chaveDasSecoes
          ? pick(section, chaveDasSecoes)
          : (pick(section, profile) ?? pick(section, profile.slice(0, 1)));
        return block ? { section, title: block.title, body: block.body } : { section, title: null, body: null };
      }).filter((s) => s.body != null)
    : isMbti
      ? mbtiSections()
      : dimensionalSections();

  // Band lookup by dimension + mode over normalized score.
  const bandFor = (dimensionId: string, mode: "natural" | "adaptado", score: number) => {
    const match = (bands ?? []).find(
      (b) =>
        b.dimension_id === dimensionId &&
        (b.mode ?? "natural") === mode &&
        score >= Number(b.min_score) &&
        score <= Number(b.max_score),
    );
    return match ? { title: match.title, description: match.description } : null;
  };

  const factors = dimList.map((d) => {
    // Dimensão não medida: devolve sem faixa nem texto. Melhor a ausência
    // explícita do que uma leitura inventada sobre um zero que não é resultado.
    if (!d.has_data) {
      return {
        ...d,
        gap: 0,
        gap_mode: null,
        band_natural: null,
        band_adaptado: null,
        adaptacao: null,
        descritores: [] as Array<{ body: string; band_min: number | null; band_max: number | null; active: boolean }>,
      };
    }
    // Com o motor ipsativo não existe diferença natural × adaptado (Etapa 2a: réguas separadas), e com
    // ela somem a "adaptação crescente/decrescente" e o texto que nascia dela.
    const gap = d.adaptado_norm == null ? null : d.adaptado_norm - d.natural_norm;
    const gapMode = gap == null ? null : gap >= 15 ? "gap_up" : gap <= -15 ? "gap_down" : null;
    const adaptacao = gapMode ? pick("adaptacao", d.key, gapMode) : null;
    const descritores = rows
      .filter((r) => r.section === "descritor" && r.dimension_key === d.key)
      .sort((a, b) => Number(a.band_min ?? 0) - Number(b.band_min ?? 0))
      .map((r) => ({
        body: r.body,
        band_min: r.band_min == null ? null : Number(r.band_min),
        band_max: r.band_max == null ? null : Number(r.band_max),
        active:
          r.band_min != null && r.band_max != null
            ? d.natural_norm >= Number(r.band_min) && d.natural_norm <= Number(r.band_max)
            : false,
      }));
    return {
      ...d,
      gap: gap == null ? null : Math.round(gap),
      gap_mode: gapMode,
      band_natural: bandFor(d.id, "natural", d.natural_norm),
      band_adaptado: d.adaptado_norm == null ? null : bandFor(d.id, "adaptado", d.adaptado_norm),
      adaptacao: adaptacao ? { title: adaptacao.title, body: adaptacao.body } : null,
      descritores,
    };
  });

  // --- Derivações calculadas sobre os normalizados por key (apenas DISC) ---
  // Com o motor ipsativo, sobre o conjunto ADAPTADO (os mesmos números de sempre) e sem um segundo
  // conjunto na mesma régua: Estima e Flexibilidade, que subtraíam um do outro, ficam sem valor.
  const naturalByKey: FactorMap = {};
  const adaptadoByKey: FactorMap = {};
  for (const d of dimList) {
    naturalByKey[d.key] = d.natural_norm;
    if (d.adaptado_norm != null) adaptadoByKey[d.key] = d.adaptado_norm;
  }
  const derivedConfig = (response.test_versions?.derived_config ?? null) as DerivedConfig | null;
  let derived: Record<string, unknown> | null = null;
  if (isDisc) {
    const core = computeDerived(naturalByKey, ips ? null : adaptadoByKey, derivedConfig);
    const leadershipContent = rows
      .filter((r) => r.section === "lideranca" && r.dimension_key === core.dominant.key)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    const leadershipSpecific = leadershipContent.filter((r) => r.version_id === versionId);
    const leadershipRows = leadershipSpecific.length > 0 ? leadershipSpecific : leadershipContent;
    derived = {
      ...core,
      leadership_content: {
        strengths: leadershipRows[0] ? { title: leadershipRows[0].title, body: leadershipRows[0].body } : null,
        attention: leadershipRows[1] ? { title: leadershipRows[1].title, body: leadershipRows[1].body } : null,
      },
    };
  }

  // --- Percepção externa (observadores 360°) ---
  const { data: observerRows } = await supabase
    .from("test_responses")
    .select("id, rater_name, computed_scores, version_id")
    .eq("parent_response_id", id)
    .eq("kind", "observer")
    .not("submitted_at", "is", null);

  let external: { count: number; respondents: string[]; scores: Record<string, number> } | null = null;
  const obsList = observerRows ?? [];
  if (obsList.length > 0) {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const o of obsList) {
      // Mesma fonte e mesmo conjunto dos números do avaliado: observador de DISC/Temperamentos/VAK vem
      // do `ipsativo` (gravado, ou derivado das respostas dele), conjunto ADAPTADO — o que a pessoa
      // mostra, que é o que quem convive observa; os demais, do formato antigo.
      let valorPorDim: Map<string, number | undefined> | null = null;
      if (fonteIpsativa) {
        const obs = await obterIpsativo(supabase, {
          responseId: o.id,
          versionId: o.version_id,
          computedScores: o.computed_scores,
        });
        if (obs) valorPorDim = new Map(obs.ipsativo.letras.map((l) => [l.dimension_id, l.adaptado.percentual]));
      } else {
        const norm = ((o.computed_scores ?? {}) as { normalized?: NormMap }).normalized;
        if (norm) valorPorDim = new Map(Object.entries(norm).map(([dimId, n]) => [dimId, n?.natural]));
      }
      if (!valorPorDim) continue;
      for (const d of dimList) {
        const v = valorPorDim.get(d.id);
        if (typeof v !== "number") continue;
        sums[d.key] = (sums[d.key] ?? 0) + v;
        counts[d.key] = (counts[d.key] ?? 0) + 1;
      }
    }
    const scores: Record<string, number> = {};
    for (const key of Object.keys(sums)) {
      scores[key] = Math.round((sums[key] / (counts[key] || 1)) * 10) / 10;
    }
    if (Object.keys(scores).length > 0) {
      external = {
        count: obsList.length,
        respondents: obsList.map((o) => o.rater_name).filter((n): n is string => !!n),
        scores,
      };
    }
  }

  // --- Página de intensidade (DISC, Temperamentos, VAK) — Etapa 2c ---
  const intensidade =
    ips && instrumentId
      ? montarIntensidade({
          ipsativo: ips,
          dimensoes: (dims ?? []).map((d) => ({ id: d.id, key: d.key, label: d.label, color: d.color ?? null })),
          instrumentId,
          versionId,
          linhas: content ?? [],
        })
      : null;

  const { brand, settings } = await loadBrandAndSettings(response.mentor_id);

  return {
    status: 200 as const,
    data: {
      brand,
      settings,
      qualidade: computed.qualidade ?? null,
      response_id: id,
      person_name: response.people?.full_name ?? null,
      instrument_id: instrumentId,
      test_title: response.test_versions?.title ?? null,
      test_description: response.test_versions?.description ?? null,
      submitted_at: response.submitted_at,
      started_at: response.started_at,
      duration: formatDuration(response.started_at, response.submitted_at),
      is_disc: isDisc,
      is_mbti: isMbti,
      /** Tipo e eixos, quando o próprio teste respondido é o de tipos psicológicos. */
      mbti: isMbti ? buildMbtiFromFactors(dimList.filter((d) => d.has_data)) : null,
      profile: isDisc && !perfilIndefinido ? profile : null,
      profile_labels: isDisc && !perfilIndefinido ? profileDims.map((d) => d.label) : [],
      perfil_indefinido: perfilIndefinido,
      factors,
      sections,
      derived,
      external,
      // Só nos instrumentos do motor ipsativo. A chave nem aparece nos demais: o relatório deles sai
      // idêntico ao de antes.
      ...(intensidade ? { intensidade } : {}),
    },
  };
}
