/**
 * Construção do relatório comportamental — compartilhada entre o relatório
 * individual (/api/public/report/$id) e o unificado da bateria
 * (/api/public/report-bateria/$id).
 */
import { computeDerived, type DerivedConfig, type FactorMap } from "@/lib/derivations";
import { loadBrandAndSettings } from "@/lib/brand.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
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

export async function buildReport(id: string) {
  const supabase = await getAdmin();
  const { data: response } = await supabase
    .from("test_responses")
    .select(
      "id, submitted_at, started_at, computed_scores, version_id, mentor_id, people(full_name), test_versions(title, description, derived_config, instrument_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!response || !response.submitted_at) {
    return { status: 404 as const, error: "Relatório indisponível: o teste ainda não foi concluído." };
  }

  const computed = (response.computed_scores ?? {}) as {
    natural?: Record<string, number>;
    adaptado?: Record<string, number>;
    normalized?: NormMap;
  };
  const normalized = computed.normalized;
  if (!normalized || Object.keys(normalized).length === 0) {
    return { status: 404 as const, error: "Este teste não gera relatório comportamental detalhado." };
  }

  const versionId = response.version_id;
  const [{ data: dims }, { data: bands }, { data: content }] = await Promise.all([
    supabase.from("test_dimensions").select("id, key, label, color, sort_order").eq("version_id", versionId).order("sort_order"),
    supabase.from("test_result_bands").select("id, dimension_id, mode, min_score, max_score, title, description").eq("version_id", versionId),
    supabase
      .from("report_content")
      .select("section, dimension_key, mode, band_min, band_max, title, body, sort_order, version_id")
      .or(`version_id.is.null,version_id.eq.${versionId}`)
      .order("sort_order"),
  ]);

  const dimList = (dims ?? []).map((d) => {
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
      adaptado: computed.adaptado?.[d.id] ?? 0,
      natural_norm: norm?.natural ?? 0,
      adaptado_norm: norm?.adaptado ?? 0,
    };
  });

  const instrumentId = response.test_versions?.instrument_id ?? null;

  // DISC quando o conjunto de keys das dimensões é exatamente {D,I,S,C}.
  const keySet = new Set(dimList.map((d) => d.key.trim().toUpperCase()));
  const isDisc = keySet.size === 4 && ["D", "I", "S", "C"].every((k) => keySet.has(k));
  const isMbti = isMbtiDims(dimList.map((d) => d.key));

  // Composite profile from natural normalized scores (só dimensões medidas).
  const ranked = dimList.filter((d) => d.has_data).sort((a, b) => b.natural_norm - a.natural_norm);
  const above = ranked.filter((d) => d.natural_norm >= 50).slice(0, 2);
  const profileDims = above.length > 0 ? above : ranked.slice(0, 1);
  const profile = profileDims.map((d) => d.key).join("");

  // Prefer version-specific content over global fallback.
  const rows = content ?? [];
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
  const dimensionalSections = () => {
    if (!instrumentId) return [];
    const measured = dimList.filter((d) => d.has_data);
    if (measured.length === 0) return [];
    const out: Array<{ section: string; title: string | null; body: string }> = [];

    const top = [...measured].sort((a, b) => b.natural_norm - a.natural_norm)[0];
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

    const forcas = aggregate("forca");
    if (forcas) out.push({ section: "potencialidades", title: "Potencialidades", body: forcas });
    const atencao = aggregate("atencao");
    if (atencao) {
      out.push({ section: "pontos_desenvolver", title: "Pontos de atenção e desenvolvimento", body: atencao });
    }
    return out;
  };

  const sections = isDisc
    ? COMPOSITE_SECTIONS.map((section) => {
        const block = pick(section, profile) ?? pick(section, profile.slice(0, 1));
        return block ? { section, title: block.title, body: block.body } : { section, title: null, body: null };
      }).filter((s) => s.body != null)
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
    const gap = d.adaptado_norm - d.natural_norm;
    const gapMode = gap >= 15 ? "gap_up" : gap <= -15 ? "gap_down" : null;
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
      gap: Math.round(gap),
      gap_mode: gapMode,
      band_natural: bandFor(d.id, "natural", d.natural_norm),
      band_adaptado: bandFor(d.id, "adaptado", d.adaptado_norm),
      adaptacao: adaptacao ? { title: adaptacao.title, body: adaptacao.body } : null,
      descritores,
    };
  });

  // --- Derivações calculadas sobre os normalizados por key (apenas DISC) ---
  const naturalByKey: FactorMap = {};
  const adaptadoByKey: FactorMap = {};
  for (const d of dimList) {
    naturalByKey[d.key] = d.natural_norm;
    adaptadoByKey[d.key] = d.adaptado_norm;
  }
  const derivedConfig = (response.test_versions?.derived_config ?? null) as DerivedConfig | null;
  let derived: Record<string, unknown> | null = null;
  if (isDisc) {
    const core = computeDerived(naturalByKey, adaptadoByKey, derivedConfig);
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
    .select("id, rater_name, computed_scores")
    .eq("parent_response_id", id)
    .eq("kind", "observer")
    .not("submitted_at", "is", null);

  let external: { count: number; respondents: string[]; scores: Record<string, number> } | null = null;
  const obsList = observerRows ?? [];
  if (obsList.length > 0) {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const o of obsList) {
      const norm = ((o.computed_scores ?? {}) as { normalized?: NormMap }).normalized;
      if (!norm) continue;
      for (const d of dimList) {
        const v = norm[d.id]?.natural;
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

  const { brand, settings } = await loadBrandAndSettings(response.mentor_id);

  return {
    status: 200 as const,
    data: {
      brand,
      settings,
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
      profile: isDisc ? profile : null,
      profile_labels: isDisc ? profileDims.map((d) => d.label) : [],
      factors,
      sections,
      derived,
      external,
    },
  };
}
