/**
 * Blocos visuais do relatório comportamental, compartilhados entre o relatório
 * individual (/relatorio/$responseId) e o unificado da bateria
 * (/relatorio-bateria/$assessmentId).
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { JUNG_BULLETS, indexPhrase } from "@/lib/derivations";

export type Descritor = { body: string; band_min: number | null; band_max: number | null; active: boolean };

export type Factor = {
  id: string; key: string; label: string; color: string | null;
  /** false = nenhuma pergunta pontua esta dimensão (dado ausente, não zero). */
  has_data?: boolean;
  natural: number; adaptado: number; natural_norm: number; adaptado_norm: number;
  gap: number; gap_mode: "gap_up" | "gap_down" | null;
  band_natural: { title: string; description: string | null } | null;
  band_adaptado: { title: string; description: string | null } | null;
  adaptacao: { title: string | null; body: string } | null;
  descritores: Descritor[];
};

export type JungPares = Array<{ left: string; right: string; leftPct: number; rightPct: number; preferred: string }>;

export type Derived = {
  jung: { tipo: string; pares: JungPares };
  leadership: Array<{ key: string; label: string; pct: number }>;
  dominant: { key: string; label: string; pct: number };
  indices: Array<{ key: string; label: string; value: number }>;
  competencias: Array<{ name: string; natural: number; adaptado: number; band: string; definition: string }>;
  leadership_content: {
    strengths: { title: string | null; body: string } | null;
    attention: { title: string | null; body: string } | null;
  };
};

/** Marca do mentor dono do link — quem abre o relatório não tem conta. */
export type ReportBrand = {
  company_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  brand_accent_color: string | null;
  site_url: string | null;
  support_email: string | null;
};

export type ReportSettings = {
  allow_pdf: boolean;
  show_brand: boolean;
  hidden_blocks: string[];
};

export type QualidadeResposta = {
  nivel: "alta" | "media" | "baixa";
  motivos: string[];
  /** Escala: distância média entre frases equivalentes. Nulo em escolha forçada. */
  consistencia: number | null;
  /** Escala: desvio padrão das notas. Nulo em escolha forçada. */
  variacao: number | null;
  /** Escolha forçada: fração de blocos equivalentes com escolhas opostas. */
  contradicoes?: number | null;
  /** Escolha forçada: fração de vezes que marcou a alternativa da mesma posição. */
  posicao_repetida?: number | null;
  segundos_por_item: number | null;
};

export type Report = {
  brand?: ReportBrand | null;
  settings?: ReportSettings | null;
  qualidade?: QualidadeResposta | null;
  response_id?: string;
  person_name: string | null;
  instrument_id?: string | null;
  test_title: string | null;
  test_description: string | null;
  submitted_at: string;
  duration: string | null;
  is_disc?: boolean;
  is_mbti?: boolean;
  profile: string | null;
  profile_labels: string[];
  /** Dimensões praticamente empatadas: não há perfil a declarar. */
  perfil_indefinido?: boolean;
  factors: Factor[];
  sections: Array<{ section: string; title: string | null; body: string }>;
  derived?: Derived | null;
  external?: { count: number; respondents: string[]; scores: Record<string, number> } | null;
};

export const SECTION_TITLES: Record<string, string> = {
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

export const PLANO_ACAO: string[] = [
  "Quais comportamentos deste relatório você reconhece com mais clareza no seu dia a dia?",
  "Em quais situações o seu perfil adaptado se distancia mais do natural? O que costuma provocar esse esforço?",
  "Qual característica do seu perfil tem gerado os melhores resultados e como ampliá-la de forma consciente?",
  "Qual ponto a desenvolver traria maior impacto se você trabalhasse nele nos próximos 90 dias?",
  "Que apoio (pessoas, rotinas, ferramentas) você precisa para sustentar essa mudança?",
  "Como você vai medir o seu progresso e em que data pretende revisitar este plano?",
];

export const PLANO_ACAO_GENERICO: string[] = [
  "Quais dimensões deste relatório descrevem bem o que você observa em si mesmo?",
  "Alguma intensidade apresentada aqui te surpreendeu? O que pode explicar isso?",
  "Qual dimensão mais alta você quer usar de forma mais consciente nos próximos meses?",
  "Qual dimensão mais baixa merece atenção e por quê?",
  "Que apoio (pessoas, rotinas, ferramentas) você precisa para avançar?",
  "Como você vai acompanhar o progresso e quando pretende revisitar este plano?",
];

export const NATURAL_COLOR = "var(--primary)";
export const ADAPTADO_COLOR = "oklch(0.62 0.14 40)";

export function Bar({ value, color, label, faded }: { value: number; color: string | null; label: string; faded?: boolean }) {
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

/** Selo que deixa explícito que um bloco é calculado, não respondido. */
export function SourceBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-input bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`report-section rounded-xl bg-card p-8 ring-1 ring-black/5 ${className}`}>{children}</section>;
}

/** Introdução metodológica (DISC ou genérica). */
export function IntroSection({ isDisc }: { isDisc: boolean }) {
  if (isDisc) {
    return (
      <Section>
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
      </Section>
    );
  }
  return (
    <Section>
      <h2 className="text-lg font-semibold">Como ler este relatório</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          Este relatório apresenta a intensidade de cada dimensão avaliada, em uma escala comparável de 0 a 100.
          Quanto maior o valor, maior o peso daquela dimensão nas suas respostas.
        </p>
        <p>
          Não há dimensões certas ou erradas: o conjunto descreve ênfases e prioridades no momento em que você
          respondeu. Leia primeiro as dimensões mais altas, depois observe as mais baixas — elas costumam explicar
          escolhas e desconfortos com a mesma clareza.
        </p>
      </div>
    </Section>
  );
}

/**
 * Corpo do relatório de UM teste. `mbtiReal` (quando presente) substitui a
 * estimativa de tipos psicológicos derivada do DISC.
 */
export function ReportBody({
  data,
  mbtiReal,
  showIntro = true,
}: {
  data: Report;
  mbtiReal?: { tipo: string; pares: JungPares } | null;
  showIntro?: boolean;
}) {
  const byKey = new Map(data.factors.map((f) => [f.key, f]));
  const isDisc = data.is_disc !== false;
  const rankedFactors = [...data.factors].sort((a, b) => b.natural_norm - a.natural_norm);
  // Blocos que o mentor desligou nas Configurações. Ausente = mostra tudo.
  const oculto = data.settings?.hidden_blocks ?? [];
  const mostrar = (bloco: string) => !oculto.includes(bloco);

  return (
    <>
      {showIntro && <IntroSection isDisc={isDisc} />}

      {mostrar("fatores") && (isDisc ? (
        <Section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Natural × Adaptado</h2>
            <p className="text-sm text-muted-foreground">
              {data.perfil_indefinido ? (
                <span>Sem predominância clara — os quatro fatores ficaram quase no mesmo nível</span>
              ) : (
                <>
                  Perfil composto: <strong className="text-foreground">{data.profile}</strong>
                  {data.profile_labels.length > 0 && <span> · {data.profile_labels.join(" + ")}</span>}
                </>
              )}
            </p>
          </div>
          <div className="mt-5 space-y-5">
            {data.factors.map((f) => (
              <div key={f.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{f.label} <span className="text-xs text-muted-foreground">({f.key})</span></span>
                  <span className="text-xs text-muted-foreground">
                    natural {Math.round(f.natural_norm)} · adaptado {Math.round(f.adaptado_norm)}
                    {data.external?.scores[f.key] != null && <> · externo {Math.round(data.external.scores[f.key])}</>}
                  </span>
                </div>
                <Bar value={f.natural_norm} color={f.color} label="Natural" />
                <Bar value={f.adaptado_norm} color={f.color} label="Adaptado" faded />
                {data.external?.scores[f.key] != null && (
                  <Bar value={data.external.scores[f.key]} color="#8b5cf6" label="Percepção externa" />
                )}
              </div>
            ))}
          </div>
          {data.external && (
            <p className="mt-4 text-xs text-muted-foreground">
              Percepção externa baseada em {data.external.count} observador(es)
              {data.external.respondents.length > 0 && <>: {data.external.respondents.join(", ")}</>}.
            </p>
          )}
        </Section>
      ) : (
        <Section>
          <h2 className="text-lg font-semibold">Intensidade por dimensão</h2>
          <p className="mt-1 text-sm text-muted-foreground">Dimensões ordenadas da maior para a menor intensidade.</p>
          <div className="mt-5 space-y-4">
            {rankedFactors.map((f) => (
              <div key={f.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{f.label} <span className="text-xs text-muted-foreground">({f.key})</span></span>
                  {data.external?.scores[f.key] != null && (
                    <span className="text-xs text-muted-foreground">externo {Math.round(data.external.scores[f.key])}</span>
                  )}
                </div>
                {f.has_data === false ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Não medida — nenhuma pergunta deste inventário pontua esta dimensão.
                  </p>
                ) : (
                  <>
                    <Bar value={f.natural_norm} color={f.color} label="Resultado" />
                    {data.external?.scores[f.key] != null && (
                      <Bar value={data.external.scores[f.key]} color="#8b5cf6" label="Externo" />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>
      ))}

      {mostrar("fatores") && !isDisc && rankedFactors.some((f) => f.band_natural) && (
        <Section>
          <h2 className="text-lg font-semibold">Leitura de cada dimensão</h2>
          <div className="mt-5 space-y-4">
            {rankedFactors.filter((f) => f.has_data !== false).map((f) => (
              <div key={f.id} className="rounded-lg border border-input p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: f.color ?? "var(--muted-foreground)" }} />
                    {f.label}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(f.natural_norm)} · {f.band_natural?.title ?? "sem faixa definida"}
                  </span>
                </div>
                {f.band_natural?.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.band_natural.description}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {mostrar("observadores") && data.external && (
        <Section>
          <h2 className="text-lg font-semibold">Como o meio percebe você</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Média das respostas de {data.external.count} observador(es) comparada à sua autoimagem.
          </p>
          <div className="mt-5 overflow-hidden rounded-lg ring-1 ring-black/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Fator</th>
                  <th className="px-4 py-2 font-medium">Natural</th>
                  <th className="px-4 py-2 font-medium">Adaptado</th>
                  <th className="px-4 py-2 font-medium">Externo</th>
                  <th className="px-4 py-2 font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.factors.map((f) => {
                  const ext = data.external?.scores[f.key];
                  const diff = ext == null ? null : Math.round(ext - f.natural_norm);
                  return (
                    <tr key={f.id}>
                      <td className="px-4 py-2 font-medium">{f.label} <span className="text-xs text-muted-foreground">({f.key})</span></td>
                      <td className="px-4 py-2">{Math.round(f.natural_norm)}</td>
                      <td className="px-4 py-2">{Math.round(f.adaptado_norm)}</td>
                      <td className="px-4 py-2">{ext == null ? "—" : Math.round(ext)}</td>
                      <td className="px-4 py-2">{diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              A percepção externa não é uma correção da sua autoimagem: são duas leituras legítimas do mesmo
              comportamento, feitas de pontos de observação diferentes. Você tem acesso à sua intenção; quem convive
              com você tem acesso ao efeito prático das suas ações.
            </p>
            <p>
              Diferenças de até cerca de 10 pontos costumam ser ruído de leitura. Acima disso, vale investigar: quando
              o externo está bem acima do natural em um fator, é provável que você venha entregando esse comportamento
              com mais intensidade do que reconhece — às vezes por exigência do contexto. Quando está bem abaixo, um
              traço que você considera evidente talvez não esteja chegando com clareza às pessoas.
            </p>
            <p>
              Use essas lacunas como pauta de conversa, não como veredito. Um número pequeno de observadores tende a
              refletir a relação específica de cada um com você; quanto mais variados os contextos representados, mais
              estável fica a leitura.
            </p>
          </div>
        </Section>
      )}

      {mostrar("narrativas") && data.sections.map((s) => (
        <Section key={s.section}>
          <h2 className="text-lg font-semibold">{s.title ?? SECTION_TITLES[s.section] ?? s.section}</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {s.body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </Section>
      ))}

      {mostrar("narrativas") && isDisc && FACTOR_THEMES.map((theme) => {
        const f = byKey.get(theme.key);
        if (!f) return null;
        return (
          <Section key={theme.key}>
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
          </Section>
        );
      })}

      {mostrar("narrativas") && isDisc && data.factors.some((f) => f.descritores.length > 0) && (
        <Section>
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
        </Section>
      )}

      {mostrar("derivados") && isDisc && data.derived && <DerivedSections d={data.derived} mbtiReal={mbtiReal ?? null} />}

      {isDisc && (
        <Section>
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
        </Section>
      )}
    </>
  );
}

export function ActionPlanSection({ responseId, questions }: { responseId: string; questions: string[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/public/action-plan/${responseId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setAnswers((j.answers ?? {}) as Record<string, string>);
        setUpdatedAt(j.updated_at ?? null);
      })
      .catch(() => undefined);
  }, [responseId]);

  const save = useCallback(
    async (payload: Record<string, string>, silent = false) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/public/action-plan/${responseId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: payload }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!silent) toast.error(j.error ?? "Não foi possível salvar o plano.");
          return;
        }
        setUpdatedAt(j.updated_at ?? new Date().toISOString());
        if (!silent) toast.success("Plano salvo.");
      } catch {
        if (!silent) toast.error("Falha de conexão ao salvar o plano.");
      } finally {
        setSaving(false);
      }
    },
    [responseId],
  );

  return (
    <Section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Plano de ação</h2>
        {updatedAt && (
          <span className="text-xs text-muted-foreground">
            salvo em {new Date(updatedAt).toLocaleString("pt-BR")}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Responda com calma, salve suas anotações e revisite-as com seu mentor.
      </p>
      <ol className="mt-4 space-y-4">
        {questions.map((q, i) => {
          const key = `q${i + 1}`;
          const value = answers[key] ?? "";
          return (
            <li key={key}>
              <p className="text-sm font-medium">{i + 1}. {q}</p>
              <Textarea
                className="mt-2 print:hidden"
                rows={3}
                maxLength={2000}
                value={value}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [key]: e.target.value }))}
                onBlur={() => void save({ ...answers, [key]: value }, true)}
                placeholder="Escreva aqui…"
              />
              <div className="mt-2 hidden min-h-12 whitespace-pre-line rounded-md border border-dashed border-input p-3 text-sm leading-relaxed print:block">
                {value}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 print:hidden">
        <Button onClick={() => void save(answers)} disabled={saving}>
          {saving ? "Salvando…" : "Salvar plano"}
        </Button>
      </div>
    </Section>
  );
}

/**
 * Ressalva de confiabilidade.
 *
 * Aparece só quando há sinal de preenchimento apressado ou contraditório. O
 * relatório sai inteiro do mesmo jeito — o que muda é avisar como ler. Um
 * resultado apresentado com a mesma segurança de sempre, vindo de quem clicou
 * no automático, é o oposto de um relatório honesto.
 */
export function AvisoDeConfiabilidade({ q }: { q?: QualidadeResposta | null }) {
  if (!q || q.nivel === "alta") return null;
  const grave = q.nivel === "baixa";
  return (
    <div className={`report-section rounded-xl p-5 ring-1 ${grave ? "bg-amber-50 ring-amber-200" : "bg-muted/50 ring-black/5"}`}>
      <p className={`text-sm font-medium ${grave ? "text-amber-900" : "text-foreground"}`}>
        {grave ? "Leia este relatório com cautela" : "Uma ressalva sobre a leitura"}
      </p>
      <p className={`mt-1 text-sm leading-relaxed ${grave ? "text-amber-800" : "text-muted-foreground"}`}>
        O jeito como o inventário foi preenchido sugere {q.motivos.join(" e ")}. Isso não invalida o
        resultado, mas reduz a confiança nele: o retrato pode estar mais borrado do que o normal.
        Se algo aqui não fizer sentido, o melhor caminho é responder de novo com calma.
      </p>
    </div>
  );
}

export function ReportFooter({ brand }: { brand?: ReportBrand | null }) {
  const nome = brand?.company_name?.trim();
  const site = brand?.site_url?.trim();
  const email = brand?.support_email?.trim();
  return (
    <footer className="report-section space-y-3 px-2 pb-8 text-xs leading-relaxed text-muted-foreground">
      <p>
        Este relatório é uma ferramenta de autoconhecimento e desenvolvimento. Ele descreve tendências de comportamento
        autorrelatadas em um momento específico e não deve ser usado isoladamente para decisões de seleção, promoção ou
        desligamento. Recomenda-se a leitura acompanhada por um mentor ou profissional qualificado.
      </p>
      {(nome || site || email) && (
        <p className="border-t border-black/5 pt-3">
          {nome && <span className="font-medium text-foreground">{nome}</span>}
          {site && <> · <a href={site} className="hover:underline" target="_blank" rel="noreferrer">{site.replace(/^https?:\/\//, "")}</a></>}
          {email && <> · <a href={`mailto:${email}`} className="hover:underline">{email}</a></>}
        </p>
      )}
    </footer>
  );
}

/** Cabeçalho de marca da capa do relatório. Só aparece se o mentor configurou. */
export function ReportBrandHeader({ brand }: { brand?: ReportBrand | null }) {
  if (!brand) return null;
  const nome = brand.company_name?.trim();
  if (!brand.logo_url && !nome) return null;
  return (
    <div className="mb-5 flex items-center gap-3">
      {brand.logo_url && <img src={brand.logo_url} alt={nome ?? "Logo"} className="h-9 max-w-44 object-contain" />}
      {nome && !brand.logo_url && (
        <span className="text-sm font-semibold uppercase tracking-tight">{nome}</span>
      )}
    </div>
  );
}

export function DerivedSections({
  d,
  mbtiReal,
}: {
  d: Derived;
  mbtiReal?: { tipo: string; pares: JungPares } | null;
}) {
  const jung = mbtiReal ?? d.jung;
  const jungFromTest = !!mbtiReal;

  return (
    <>
      {/* Tipos psicológicos */}
      <Section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Tipos psicológicos</h2>
          <span className="rounded-md bg-muted px-3 py-1 text-sm font-semibold tracking-[0.2em]">{jung.tipo}</span>
        </div>
        <div className="mt-2">
          <SourceBadge>
            {jungFromTest ? "Com base nas suas respostas do inventário MBTI" : "Estimativa derivada do seu DISC"}
          </SourceBadge>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {jungFromTest
            ? "Leitura das preferências mentais a partir do inventário que você respondeu. Os polos são complementares: o percentual indica ênfase, não ausência do lado oposto."
            : "Você não respondeu um inventário de tipos psicológicos nesta avaliação. Os percentuais abaixo são uma estimativa calculada a partir do seu perfil DISC — útil como hipótese de leitura, não como resultado de teste."}
        </p>
        <div className="mt-5 space-y-5">
          {jung.pares.map((p) => (
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
      </Section>

      {/* Estilo de liderança */}
      <Section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Estilo de liderança</h2>
          <p className="text-sm text-muted-foreground">
            Dominante: <strong className="text-foreground">{d.dominant.label}</strong> ({Math.round(d.dominant.pct)}%)
          </p>
        </div>
        <div className="mt-2"><SourceBadge>Derivado do seu DISC</SourceBadge></div>
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
      </Section>

      {/* Mapa de competências */}
      <Section>
        <h2 className="text-lg font-semibold">Mapa de competências</h2>
        <div className="mt-2"><SourceBadge>Derivado do seu DISC</SourceBadge></div>
        <p className="mt-3 text-sm text-muted-foreground">
          Dezesseis competências calculadas a partir da combinação dos seus fatores. A linha sólida representa o perfil
          natural; a tracejada, o adaptado.
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
      </Section>

      {/* Índices comportamentais */}
      <Section>
        <h2 className="text-lg font-semibold">Índices comportamentais</h2>
        <div className="mt-2"><SourceBadge>Derivado do seu DISC</SourceBadge></div>
        <p className="mt-3 text-sm text-muted-foreground">Valores de 0 a 1 que resumem tendências gerais do seu momento atual.</p>
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
      </Section>
    </>
  );
}

export function RadarChart({ items }: { items: Derived["competencias"] }) {
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

export const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  html, body { background: #fff !important; }
  /* No tema escuro o texto é claro — no papel branco sumiria. Papel é sempre
     claro, independente de como a pessoa esteja lendo na tela. */
  html, html.dark {
    --background: #ffffff !important;
    --foreground: #111111 !important;
    --card: #ffffff !important;
    --card-foreground: #111111 !important;
    --muted: #f1f1f4 !important;
    --muted-foreground: #4b4b55 !important;
    --border: rgba(0,0,0,0.12) !important;
    --input: rgba(0,0,0,0.12) !important;
  }
  /* Sem !important de propósito: a cor da marca do mentor (aplicada inline)
     continua ganhando e sai impressa. */
  html.dark { --primary: oklch(0.38 0.06 210); --primary-foreground: #ffffff; }
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
