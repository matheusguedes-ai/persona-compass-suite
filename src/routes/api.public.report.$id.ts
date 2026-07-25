import { createFileRoute } from "@tanstack/react-router";
import { computeDerived, type DerivedConfig, type FactorMap } from "@/lib/derivations";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type NormMap = Record<string, { natural: number; adaptado: number }>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function formatDuration(startIso: string | null, endIso: string | null): string | null {
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

async function buildReport(id: string) {
  const supabase = await getAdmin();
  const { data: response } = await supabase
    .from("test_responses")
    .select("id, submitted_at, started_at, computed_scores, version_id, people(full_name), test_versions(title, description, derived_config)")
    .eq("id", id)
    .maybeSingle();

  if (!response || !response.submitted_at) return { status: 404 as const, error: "Relatório indisponível: o teste ainda não foi concluído." };

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
    supabase.from("report_content").select("section, dimension_key, mode, band_min, band_max, title, body, sort_order, version_id").or(`version_id.is.null,version_id.eq.${versionId}`).order("sort_order"),
  ]);

  const dimList = (dims ?? []).map((d) => ({
    id: d.id,
    key: d.key,
    label: d.label,
    color: d.color ?? null,
    natural: computed.natural?.[d.id] ?? 0,
    adaptado: computed.adaptado?.[d.id] ?? 0,
    natural_norm: normalized[d.id]?.natural ?? 0,
    adaptado_norm: normalized[d.id]?.adaptado ?? 0,
  }));

  // Composite profile from natural normalized scores.
  const ranked = [...dimList].sort((a, b) => b.natural_norm - a.natural_norm);
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

  const sections = COMPOSITE_SECTIONS.map((section) => {
    const block = pick(section, profile) ?? pick(section, profile.slice(0, 1));
    return block ? { section, title: block.title, body: block.body } : { section, title: null, body: null };
  }).filter((s) => s.body != null);

  // Band lookup by dimension + mode over normalized score.
  const bandFor = (dimensionId: string, mode: "natural" | "adaptado", score: number) => {
    const match = (bands ?? []).find(
      (b) => b.dimension_id === dimensionId && (b.mode ?? "natural") === mode && score >= Number(b.min_score) && score <= Number(b.max_score),
    );
    return match ? { title: match.title, description: match.description } : null;
  };

  const factors = dimList.map((d) => {
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

  return {
    status: 200 as const,
    data: {
      person_name: response.people?.full_name ?? null,
      test_title: response.test_versions?.title ?? null,
      test_description: response.test_versions?.description ?? null,
      submitted_at: response.submitted_at,
      duration: formatDuration(response.started_at, response.submitted_at),
      profile,
      profile_labels: profileDims.map((d) => d.label),
      factors,
      sections,
      derived,
    },
  };
}

export const Route = createFileRoute("/api/public/report/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const out = await buildReport(params.id);
          if (out.status === 404) return json({ error: out.error }, 404);
          return json(out.data);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro";
          return json({ error: msg }, 500);
        }
      },
    },
  },
});
