import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { JUNG_BULLETS, indexPhrase } from "@/lib/derivations";

export const Route = createFileRoute("/relatorio/$responseId")({
  head: () => ({
    meta: [
      { title: "Relatório comportamental" },
      { name: "description", content: "Relatório comportamental detalhado do avaliado, com perfil natural e adaptado." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Relatório comportamental" },
      { property: "og:description", content: "Relatório comportamental detalhado do avaliado, com perfil natural e adaptado." },
    ],
  }),
  component: RelatorioPage,
});

type Descritor = { body: string; band_min: number | null; band_max: number | null; active: boolean };
type Factor = {
  id: string; key: string; label: string; color: string | null;
  natural: number; adaptado: number; natural_norm: number; adaptado_norm: number;
  gap: number; gap_mode: "gap_up" | "gap_down" | null;
  band_natural: { title: string; description: string | null } | null;
  band_adaptado: { title: string; description: string | null } | null;
  adaptacao: { title: string | null; body: string } | null;
  descritores: Descritor[];
};
type Report = {
  person_name: string | null;
  test_title: string | null;
  test_description: string | null;
  submitted_at: string;
  duration: string | null;
  profile: string;
  profile_labels: string[];
  factors: Factor[];
  sections: Array<{ section: string; title: string | null; body: string }>;
  derived?: Derived | null;
};

type Derived = {
  jung: {
    tipo: string;
    pares: Array<{ left: string; right: string; leftPct: number; rightPct: number; preferred: string }>;
  };
  leadership: Array<{ key: string; label: string; pct: number }>;
  dominant: { key: string; label: string; pct: number };
  indices: Array<{ key: string; label: string; value: number }>;
  competencias: Array<{ name: string; natural: number; adaptado: number; band: string; definition: string }>;
  leadership_content: {
    strengths: { title: string | null; body: string } | null;
    attention: { title: string | null; body: string } | null;
  };
};

const SECTION_TITLES: Record<string, string> = {
  sintese: "Síntese do perfil",
  potencialidades: "Potencialidades",
  relacoes: "Relações interpessoais",
  decisao: "Tomada de decisão",
  motivador: "Motivadores",
  medos: "Medos e tensões",
  adequacao: "Adequação profissional",
  pontos_desenvolver: "Pontos a desenvolver",
};

const FACTOR_THEMES: Array<{ key: string; title: string }> = [
  { key: "D", title: "Como você lida com problemas e desafios" },
  { key: "I", title: "Como você lida com pessoas e influência" },
  { key: "S", title: "Como você lida com ritmo e consistência" },
  { key: "C", title: "Como você lida com regras e procedimentos" },
];

const COMUNICACAO: Array<{ key: string; label: string; body: string }> = [
  { key: "D", label: "Com perfis de foco em resultado (D)", body: "Vá direto ao ponto. Comece pela conclusão, apresente opções objetivas e deixe a decisão nas mãos da pessoa. Evite rodeios, contexto excessivo e conversas paralelas antes do assunto principal." },
  { key: "I", label: "Com perfis de foco em pessoas (I)", body: "Abra espaço para o diálogo e reconheça as ideias trazidas. Use exemplos, histórias e um tom entusiasmado, mas registre por escrito os combinados para que nada se perca no calor da conversa." },
  { key: "S", label: "Com perfis de foco em estabilidade (S)", body: "Fale com calma, explique o porquê das mudanças e dê tempo para a assimilação. Garanta previsibilidade: combine prazos realistas e confirme que a pessoa se sente segura antes de avançar." },
  { key: "C", label: "Com perfis de foco em precisão (C)", body: "Traga dados, critérios e fontes. Antecipe as perguntas sobre qualidade e risco, evite generalizações e permita tempo de análise antes de pedir um posicionamento." },
];

const PLANO_ACAO: string[] = [
  "Quais comportamentos deste relatório você reconhece com mais clareza no seu dia a dia?",
  "Em quais situações o seu perfil adaptado se distancia mais do natural? O que costuma provocar esse esforço?",
  "Qual característica do seu perfil tem gerado os melhores resultados e como ampliá-la de forma consciente?",
  "Qual ponto a desenvolver traria maior impacto se você trabalhasse nele nos próximos 90 dias?",
  "Que apoio (pessoas, rotinas, ferramentas) você precisa para sustentar essa mudança?",
  "Como você vai medir o seu progresso e em que data pretende revisitar este plano?",
];

function RelatorioPage() {
  const { responseId } = Route.useParams();
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/report/${responseId}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) { setError(json.error ?? "Relatório indisponível."); return; }
        setData(json as Report);
      })
      .catch(() => setError("Falha de conexão. Tente novamente."));
  }, [responseId]);

  if (error) return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">{error}</div>;
  if (!data) return <div className="mx-auto max-w-2xl p-10 text-center text-sm text-muted-foreground">Carregando relatório…</div>;

  const byKey = new Map(data.factors.map((f) => [f.key, f]));

  return (
    <div className="report-root mx-auto max-w-3xl space-y-6 p-6 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()}><Printer className="size-4" /> Baixar PDF</Button>
      </div>

      {/* Capa */}
      <section className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Relatório comportamental</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{data.person_name ?? "Avaliado"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.test_title}</p>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Concluído em</dt>
            <dd className="font-medium">{new Date(data.submitted_at).toLocaleDateString("pt-BR")}</dd>
          </div>
          {data.duration && (
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Duração</dt>
              <dd className="font-medium">{data.duration}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Perfil</dt>
            <dd className="font-medium">{data.profile}</dd>
          </div>
        </dl>
      </section>

      {/* Introdução metodológica */}
      <section className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
        <h2 className="text-lg font-semibold">Como ler este relatório</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Este relatório organiza a leitura do seu comportamento em quatro fatores observáveis, derivados da tradição
            iniciada por William Moulton Marston na década de 1920: a forma como você reage a problemas e desafios (D),
            como se relaciona e influencia pessoas (I), o ritmo e a constância com que conduz suas atividades (S) e o
            grau de apego a regras, critérios e procedimentos (C).
          </p>
          <p>
            Não existem fatores melhores ou piores. Cada combinação descreve tendências de comportamento — não mede
            inteligência, caráter, competência técnica ou potencial de crescimento. O que o instrumento oferece é um
            vocabulário comum para conversar sobre estilos de agir e sobre os ajustes que cada contexto exige.
          </p>
          <p>
            Você verá dois conjuntos de resultados. O perfil <strong>natural</strong> descreve o comportamento mais
            espontâneo, aquele que aparece quando não há pressão externa. O perfil <strong>adaptado</strong> descreve o
            que você tem apresentado no ambiente atual. Diferenças relevantes entre os dois indicam esforço consciente
            de ajuste — algo saudável em doses moderadas e desgastante quando prolongado.
          </p>
        </div>
      </section>

      {/* Gráficos */}
      <section className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Natural × Adaptado</h2>
          <p className="text-sm text-muted-foreground">
            Perfil composto: <strong className="text-foreground">{data.profile}</strong>
            {data.profile_labels.length > 0 && <span> · {data.profile_labels.join(" + ")}</span>}
          </p>
        </div>
        <div className="mt-5 space-y-5">
          {data.factors.map((f) => (
            <div key={f.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{f.label} <span className="text-xs text-muted-foreground">({f.key})</span></span>
                <span className="text-xs text-muted-foreground">
                  natural {Math.round(f.natural_norm)} · adaptado {Math.round(f.adaptado_norm)}
                </span>
              </div>
              <Bar value={f.natural_norm} color={f.color} label="Natural" />
              <Bar value={f.adaptado_norm} color={f.color} label="Adaptado" faded />
            </div>
          ))}
        </div>
      </section>

      {/* Seções do composto */}
      {data.sections.map((s) => (
        <section key={s.section} className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
          <h2 className="text-lg font-semibold">{s.title ?? SECTION_TITLES[s.section] ?? s.section}</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {s.body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </section>
      ))}

      {/* Blocos por fator */}
      {FACTOR_THEMES.map((theme) => {
        const f = byKey.get(theme.key);
        if (!f) return null;
        return (
          <section key={theme.key} className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
            <h2 className="text-lg font-semibold">{theme.title}</h2>
            <div className="mt-4">
              <Bar value={f.natural_norm} color={f.color} label="Natural" />
              <Bar value={f.adaptado_norm} color={f.color} label="Adaptado" faded />
            </div>
            {f.band_natural && (
              <div className="mt-4">
                <p className="text-sm font-semibold">{f.band_natural.title}</p>
                {f.band_natural.description && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.band_natural.description}</p>
                )}
              </div>
            )}
            {f.adaptacao && (
              <div className="mt-4 rounded-lg border border-input bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {f.adaptacao.title ?? (f.gap_mode === "gap_up" ? "Você tem elevado este fator" : "Você tem contido este fator")}
                  {" "}({f.gap > 0 ? "+" : ""}{f.gap} pontos)
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.adaptacao.body}</p>
              </div>
            )}
          </section>
        );
      })}

      {/* Régua de descritores */}
      {data.factors.some((f) => f.descritores.length > 0) && (
        <section className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
          <h2 className="text-lg font-semibold">Régua de descritores</h2>
          <p className="mt-1 text-sm text-muted-foreground">A faixa destacada corresponde à sua intensidade natural em cada fator.</p>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {data.factors.map((f) => (
              <div key={f.id}>
                <p className="text-sm font-medium">
                  <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: f.color ?? "var(--muted-foreground)" }} />
                  {f.label}
                </p>
                <ul className="mt-2 space-y-1">
                  {f.descritores.map((d, i) => (
                    <li
                      key={i}
                      className={`rounded-md px-3 py-1.5 text-sm ${d.active ? "font-semibold text-foreground ring-1 ring-black/10" : "text-muted-foreground"}`}
                      style={d.active ? { background: `${f.color ?? "#888"}22` } : undefined}
                    >
                      {d.body}
                      {d.band_min != null && d.band_max != null && (
                        <span className="ml-2 text-[10px] text-muted-foreground">{Math.round(d.band_min)}–{Math.round(d.band_max)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comunicação */}
      {data.derived && <DerivedSections d={data.derived} />}

      <section className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
        <h2 className="text-lg font-semibold">Sugestões de comunicação</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ajustes simples que aumentam a chance de ser compreendido por cada estilo.</p>
        <div className="mt-4 space-y-4">
          {COMUNICACAO.map((c) => (
            <div key={c.key} className="rounded-lg border border-input p-4">
              <p className="text-sm font-semibold">{c.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plano de ação */}
      <section className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
        <h2 className="text-lg font-semibold">Plano de ação</h2>
        <p className="mt-1 text-sm text-muted-foreground">Responda com calma, de preferência por escrito, e revisite as respostas com seu mentor.</p>
        <ol className="mt-4 space-y-4">
          {PLANO_ACAO.map((q, i) => (
            <li key={i}>
              <p className="text-sm font-medium">{i + 1}. {q}</p>
              <div className="mt-2 h-12 rounded-md border border-dashed border-input" />
            </li>
          ))}
        </ol>
      </section>

      <footer className="report-section px-2 pb-8 text-xs leading-relaxed text-muted-foreground">
        Este relatório é uma ferramenta de autoconhecimento e desenvolvimento. Ele descreve tendências de comportamento
        autorrelatadas em um momento específico e não deve ser usado isoladamente para decisões de seleção, promoção ou
        desligamento. Recomenda-se a leitura acompanhada por um mentor ou profissional qualificado.
      </footer>
    </div>
  );
}

function Bar({ value, color, label, faded }: { value: number; color: string | null; label: string; faded?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color ?? "var(--primary)", opacity: faded ? 0.55 : 1 }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums">{Math.round(pct)}</span>
    </div>
  );
}

const NATURAL_COLOR = "var(--primary)";
const ADAPTADO_COLOR = "oklch(0.62 0.14 40)";

function DerivedSections({ d }: { d: Derived }) {
  return (
    <>
      {/* Tipos psicológicos */}
      <section className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Tipos psicológicos</h2>
          <span className="rounded-md bg-muted px-3 py-1 text-sm font-semibold tracking-[0.2em]">{d.jung.tipo}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Leitura das preferências mentais derivada do seu perfil natural. Os polos são complementares: o percentual
          indica ênfase, não ausência do lado oposto.
        </p>
        <div className="mt-5 space-y-5">
          {d.jung.pares.map((p) => (
            <div key={p.left}>
              <div className="flex items-center justify-between text-sm font-medium">
                <span className={p.preferred === p.left ? "" : "text-muted-foreground"}>{p.left} {Math.round(p.leftPct)}%</span>
                <span className={p.preferred === p.right ? "" : "text-muted-foreground"}>{Math.round(p.rightPct)}% {p.right}</span>
              </div>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full" style={{ width: `${p.leftPct}%`, background: NATURAL_COLOR }} />
                <div className="h-full" style={{ width: `${p.rightPct}%`, background: ADAPTADO_COLOR, opacity: 0.55 }} />
              </div>
              <ul className="mt-3 space-y-1.5">
                {(JUNG_BULLETS[p.preferred] ?? []).map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Estilo de liderança */}
      <section className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Estilo de liderança</h2>
          <p className="text-sm text-muted-foreground">
            Dominante: <strong className="text-foreground">{d.dominant.label}</strong> ({Math.round(d.dominant.pct)}%)
          </p>
        </div>
        <div className="mt-5 space-y-2">
          {d.leadership.map((s) => (
            <Bar key={s.key} value={s.pct} color={s.key === d.dominant.key ? NATURAL_COLOR : "var(--muted-foreground)"} label={s.label} faded={s.key !== d.dominant.key} />
          ))}
        </div>
        {(d.leadership_content.strengths || d.leadership_content.attention) && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {d.leadership_content.strengths && (
              <div className="rounded-lg border border-input p-4">
                <p className="text-sm font-semibold">{d.leadership_content.strengths.title ?? "Pontos fortes"}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{d.leadership_content.strengths.body}</p>
              </div>
            )}
            {d.leadership_content.attention && (
              <div className="rounded-lg border border-input p-4">
                <p className="text-sm font-semibold">{d.leadership_content.attention.title ?? "Pontos de atenção"}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{d.leadership_content.attention.body}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Mapa de competências */}
      <section className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
        <h2 className="text-lg font-semibold">Mapa de competências</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dezesseis competências derivadas da combinação dos seus fatores. A linha sólida representa o perfil natural;
          a tracejada, o adaptado.
        </p>
        <RadarChart items={d.competencias} />
        <div className="mt-6 space-y-4">
          {d.competencias.map((c) => (
            <div key={c.name}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{c.name}</p>
                <span className="text-xs text-muted-foreground">
                  natural {Math.round(c.natural)} · adaptado {Math.round(c.adaptado)} · <strong className="text-foreground">{c.band}</strong>
                </span>
              </div>
              <Bar value={c.natural} color={NATURAL_COLOR} label="Natural" />
              <Bar value={c.adaptado} color={ADAPTADO_COLOR} label="Adaptado" faded />
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.definition}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Índices comportamentais */}
      <section className="report-section rounded-xl bg-card p-8 ring-1 ring-black/5">
        <h2 className="text-lg font-semibold">Índices comportamentais</h2>
        <p className="mt-1 text-sm text-muted-foreground">Valores de 0 a 1 que resumem tendências gerais do seu momento atual.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {d.indices.map((i) => (
            <div key={i.key} className="rounded-lg border border-input p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">{i.label}</p>
                <span className="text-2xl font-medium tabular-nums">{i.value.toFixed(2)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${i.value * 100}%`, background: NATURAL_COLOR }} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{indexPhrase(i.key, i.value)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function RadarChart({ items }: { items: Derived["competencias"] }) {
  const size = 520;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 170;
  const n = items.length;
  const point = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };
  const poly = (key: "natural" | "adaptado") =>
    items.map((it, i) => point(i, it[key]).join(",")).join(" ");

  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[520px]" role="img" aria-label="Radar das 16 competências">
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={items.map((_, i) => point(i, ring).join(",")).join(" ")}
            fill="none"
            stroke="currentColor"
            className="text-muted-foreground/25"
            strokeWidth={1}
          />
        ))}
        {items.map((it, i) => {
          const [x, y] = point(i, 100);
          const [lx, ly] = point(i, 118);
          return (
            <g key={it.name}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" className="text-muted-foreground/20" strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                fontSize={10}
                textAnchor={lx > cx + 4 ? "start" : lx < cx - 4 ? "end" : "middle"}
                dominantBaseline="middle"
                fill="currentColor"
                className="text-muted-foreground"
              >
                {it.name}
              </text>
            </g>
          );
        })}
        <polygon points={poly("adaptado")} fill={ADAPTADO_COLOR} fillOpacity={0.18} stroke={ADAPTADO_COLOR} strokeWidth={2} strokeDasharray="6 4" />
        <polygon points={poly("natural")} fill={NATURAL_COLOR} fillOpacity={0.22} stroke={NATURAL_COLOR} strokeWidth={2} />
      </svg>
      <div className="mt-2 flex justify-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded" style={{ background: NATURAL_COLOR }} /> Natural
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded" style={{ background: ADAPTADO_COLOR, opacity: 0.7 }} /> Adaptado
        </span>
      </div>
    </div>
  );
}

function _BarLegacy({ value, color, label, faded }: { value: number; color: string | null; label: string; faded?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color ?? "var(--primary)", opacity: faded ? 0.55 : 1 }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums">{Math.round(pct)}</span>
    </div>
  );
}

const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  html, body { background: #fff !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .print\\:hidden { display: none !important; }
  .report-root { max-width: none !important; padding: 0 !important; gap: 0 !important; }
  .report-section {
    break-inside: avoid;
    page-break-inside: avoid;
    box-shadow: none !important;
    padding: 0 0 10mm 0 !important;
  }
  .report-section + .report-section { break-before: page; page-break-before: always; }
}
`;
