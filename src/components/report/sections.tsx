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
import { fetchComSessao } from "@/lib/fetch-com-sessao";
import type { GraficoDoConjunto, Intensidade } from "@/lib/intensidade";
import {
  rotuloDaSituacao,
  type SwotComunicadorPorLetra, type GanhosPerdasPorLetra, type OndeAparece, type ComunicadoresSemelhantes,
} from "@/lib/disc-secoes-extra";
import {
  CONFIABILIDADE,
  CORPO,
  DERIVADOS,
  INTENSIDADE,
  INTRO,
  JUNG,
  OBSERVADORES,
  RODAPE_LEGAL,
  SWOT_COMUNICADOR,
  GANHOS_PERDAS,
  ONDE_APARECE,
  COMUNICADORES_SEMELHANTES,
  PERFIL_COMBINADO,
  avisoDeSinal,
} from "@/components/report/textos";

// Os textos fixos do relatório moram em `textos.ts` desde a #293: o PDF é montado no servidor,
// sem React, e precisa das MESMAS frases. Aqui eles só são reexportados para quem já os
// importava deste arquivo.
export {
  COMUNICACAO,
  FACTOR_THEMES,
  FAIXA_DO_GRAFICO,
  PLANO_ACAO,
  PLANO_ACAO_GENERICO,
  SECTION_TITLES,
} from "@/components/report/textos";
import {
  COMUNICACAO,
  FACTOR_THEMES,
  FAIXA_DO_GRAFICO,
  INDICE_EM_REVISAO,
  PLANO_ACAO,
  PLANO_ACAO_GENERICO,
  SECTION_TITLES,
} from "@/components/report/textos";

export type Descritor = { body: string; band_min: number | null; band_max: number | null; active: boolean };

export type Factor = {
  id: string; key: string; label: string; color: string | null;
  /** false = nenhuma pergunta pontua esta dimensão (dado ausente, não zero). */
  has_data?: boolean;
  /**
   * Nos instrumentos do motor ipsativo (DISC, Temperamentos, VAK), `natural`/`natural_norm` guardam o
   * número das leituras por fator — que na linguagem do motor é o conjunto ADAPTADO (vezes MAIS) — e
   * `adaptado`/`adaptado_norm` vêm `null`: não há mais um segundo número na mesma régua. Os gráficos
   * natural e adaptado de verdade estão em `Report.intensidade`.
   */
  natural: number; adaptado: number | null; natural_norm: number; adaptado_norm: number | null;
  gap: number | null; gap_mode: "gap_up" | "gap_down" | null;
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
  /** `value: null` = índice em revisão (Estima e Flexibilidade no motor ipsativo). */
  indices: Array<{ key: string; label: string; value: number | null }>;
  /** `adaptado: null` = só uma série (motor ipsativo: não há segundo conjunto na mesma régua). */
  competencias: Array<{ name: string; natural: number; adaptado: number | null; band: string; definition: string }>;
  leadership_content: {
    strengths: { title: string | null; body: string } | null;
    attention: { title: string | null; body: string } | null;
  };
};

/** Marca do mentor dono do link — quem abre o relatório não tem conta. */
export type ReportBrand = {
  company_cnpj?: string | null;
  company_seal_name?: string | null;
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
  /** Preenchido só quando o teste respondido é o de tipos psicológicos. */
  mbti?: { tipo: string; pares: JungPares } | null;
  profile: string | null;
  profile_labels: string[];
  /** Dimensões praticamente empatadas: não há perfil a declarar. */
  perfil_indefinido?: boolean;
  factors: Factor[];
  sections: Array<{ section: string; title: string | null; body: string }>;
  derived?: Derived | null;
  external?: { count: number; respondents: string[]; scores: Record<string, number> } | null;
  /** Página de intensidade (DISC, Temperamentos, VAK — motor ipsativo). Ausente nos demais. */
  intensidade?: Intensidade | null;
  /**
   * #302 — só DISC. Ausente quando o perfil não tem a seção cadastrada (item 3: sem buraco
   * visual). SWOT e Ganhos-Perdas trazem 1 entrada nos perfis simples (D/I/S/C) e 2 nos
   * combinados (regra de herança — cada entrada é a leitura de uma letra).
   */
  swot_comunicador?: SwotComunicadorPorLetra[] | null;
  ganhos_perdas?: GanhosPerdasPorLetra[] | null;
  onde_aparece?: OndeAparece | null;
  comunicadores_semelhantes?: ComunicadoresSemelhantes | null;
};

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
/**
 * Negrito em `**assim**` dentro do texto do relatório.
 *
 * As seções que juntam várias dimensões num bloco só ficam legíveis com um
 * rótulo destacado abrindo cada parágrafo ("**Extroversão no trabalho.** …").
 * É a única marcação suportada de propósito: o conteúdo vem do banco, e
 * interpretar HTML de lá seria abrir uma porta que não precisa existir.
 */
function comNegrito(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith("**") && parte.endsWith("**") ? (
      <strong key={i} className="text-foreground">{parte.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{parte}</span>
    ),
  );
}

/**
 * Igual ao `comNegrito`, mas o destaque HERDA a cor do parágrafo em vez de escurecer. Os textos que
 * vieram do JSX para `textos.ts` na #293 tinham `<strong>` sem classe; este helper preserva isso,
 * para a tela sair idêntica à de antes da mudança.
 */
function comNegritoHerdado(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith("**") && parte.endsWith("**") ? (
      <strong key={i}>{parte.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{parte}</span>
    ),
  );
}

export function IntroSection({ isDisc, isMbti, ipsativo }: { isDisc: boolean; isMbti?: boolean; ipsativo?: boolean }) {
  const paragrafos = isMbti
    ? INTRO.mbti
    : isDisc
      ? [...INTRO.disc, ipsativo ? INTRO.discIpsativo : INTRO.discClassico]
      : INTRO.dimensional;
  return (
    <Section>
      <h2 className="text-lg font-semibold">{INTRO.titulo}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {paragrafos.map((t, i) => (
          <p key={i}>{comNegritoHerdado(t)}</p>
        ))}
      </div>
    </Section>
  );
}

const COR_EXTERNO = "#8b5cf6";

function BarraDoGrafico({ valor, cor, apagada, rotulo }: { valor: number; cor: string; apagada?: boolean; rotulo?: string }) {
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div className="mt-1 flex items-center gap-2">
      {rotulo && <span className="w-14 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{rotulo}</span>}
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor, opacity: apagada ? 0.45 : 1 }} />
      </div>
      <span className="w-7 shrink-0 text-right text-xs font-medium tabular-nums">{Math.round(pct)}</span>
    </div>
  );
}

/**
 * Um dos dois gráficos da página de intensidade, com a PRÓPRIA sigla. Nada aqui olha para o outro
 * gráfico: cada um mostra o percentual da soma do seu conjunto (as letras de um gráfico somam 100).
 */
function GraficoDoPerfil({
  titulo,
  explica,
  g,
  externo,
}: {
  titulo: string;
  explica: string;
  g: GraficoDoConjunto;
  externo?: Record<string, number> | null;
}) {
  const comExterno = !!externo && g.letras.some((l) => externo[l.key] != null);
  return (
    <div className="rounded-lg border border-input p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{titulo}</p>
        <span className="rounded-md bg-muted px-2.5 py-0.5 text-sm font-semibold tracking-[0.15em]">{g.sigla ?? "—"}</span>
      </div>
      <p className="mt-1 text-right text-[11px] text-muted-foreground">
        {g.sigla && g.faixa ? FAIXA_DO_GRAFICO[g.faixa] : "sem predominância clara"}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{explica}</p>
      <div className="mt-4 space-y-3">
        {g.letras.map((l) => (
          <div key={l.key}>
            <p className={`text-sm ${l.na_sigla ? "font-semibold" : "text-muted-foreground"}`}>
              {l.label} <span className="text-xs font-normal text-muted-foreground">({l.key})</span>
              {l.pouca_informacao && (
                <span className="ml-2 rounded-full border border-input px-2 py-0.5 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                  {INTENSIDADE.poucaInformacao}
                </span>
              )}
            </p>
            <BarraDoGrafico
              valor={l.percentual}
              cor={l.color ?? "var(--primary)"}
              apagada={!l.na_sigla}
              rotulo={comExterno ? "Você" : undefined}
            />
            {comExterno && externo?.[l.key] != null && (
              <BarraDoGrafico valor={externo[l.key]} cor={COR_EXTERNO} rotulo="Externo" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


/**
 * PÁGINA DE INTENSIDADE (#288, Etapa 2c) — DISC, Temperamentos e VAK, no padrão da referência que o
 * dono do produto usa: "PERFIL <sigla do natural>", os três índices lado a lado (só DISC) e os gráficos
 * NATURAL e ADAPTADO separados, cada um com a própria sigla. Depois, o texto do perfil — cadastrável em
 * `report_content`; enquanto a sigla não tem texto aprovado, um aviso no lugar, nunca texto inventado.
 */
export function IntensidadeDoPerfil({
  data,
  intensidade,
  mostrarIndices,
}: {
  data: Report;
  intensidade: Intensidade;
  mostrarIndices: boolean;
}) {
  const { perfil, natural, adaptado, texto } = intensidade;
  const indices = mostrarIndices
    ? ["positividade", "estima", "flexibilidade"]
        .map((k) => data.derived?.indices.find((i) => i.key === k))
        .filter((i): i is Derived["indices"][number] => i != null)
    : [];
  const ext = data.external ?? null;
  const dimensional = data.is_disc === false;

  return (
    <Section>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{INTENSIDADE.rotulo}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[0.08em]">
        {perfil.sigla ? `PERFIL ${perfil.sigla}` : INTENSIDADE.semPredominancia}
      </h2>
      {perfil.labels.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{perfil.labels.join(" · ")}</p>}
      {!perfil.sigla && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {natural.tipo === "sem_sinal"
            ? INTENSIDADE.semSinal
            : INTENSIDADE.empateMultiplo}
        </p>
      )}

      {indices.length > 0 && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {indices.map((i) => (
              <div key={i.key} className="rounded-lg border border-input p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{i.label}</p>
                {i.value == null ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">Em revisão</p>
                ) : (
                  <p className="mt-1 text-2xl font-medium tabular-nums">{i.value.toFixed(2)}</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {INTENSIDADE.indicesRodape}
            {indices.some((i) => i.value == null) && INTENSIDADE.indicesEmRevisao}
          </p>
        </>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <GraficoDoPerfil
          titulo={INTENSIDADE.naturalTitulo}
          explica={INTENSIDADE.naturalExplica}
          g={natural}
        />
        <GraficoDoPerfil
          titulo={INTENSIDADE.adaptadoTitulo}
          explica={INTENSIDADE.adaptadoExplica}
          g={adaptado}
          externo={ext?.scores ?? null}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {INTENSIDADE.reguasSeparadas}
      </p>
      {intensidade.sinal_baixo.length > 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-input p-3 text-sm leading-relaxed text-muted-foreground">
          {avisoDeSinal(intensidade.sinal_baixo, intensidade.marcacoes_no_teste)}
        </p>
      )}
      {ext && (
        <p className="mt-1 text-xs text-muted-foreground">
          Percepção externa (em roxo, no gráfico adaptado) baseada em {ext.count} observador(es)
          {ext.respondents.length > 0 && <>: {ext.respondents.join(", ")}</>}.
        </p>
      )}

      {texto && perfil.sigla && (texto.estado === "publicado" ? (
        <div className="mt-6 border-t border-black/5 pt-5">
          <h3 className="text-base font-semibold">{texto.titulo ?? `Sobre o perfil ${perfil.sigla}`}</h3>
          <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {texto.corpo.split(/\n{2,}/).map((p, i) => <p key={i}>{comNegrito(p)}</p>)}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-input p-4">
          <p className="text-sm font-medium">Sobre o perfil {perfil.sigla}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {INTENSIDADE.textoPendente}
          </p>
        </div>
      ))}

      {dimensional && (
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          {INTENSIDADE.leiturasDoAdaptado}
        </p>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------------------------------
// Seções extras do DISC (#302) — "SWOT do Comunicador" (não confundir com o painel de
// devolutiva do mentor, outra coisa — ver docs/plano-painel-devolutiva.md). Mesmo padrão da
// intensidade: chave ausente no payload = seção não aparece, sem aviso de "pendente".
// ------------------------------------------------------------------------------------------

function QuadranteSwot({
  rotulo, subtitulo, itens, bg, dot,
}: { rotulo: string; subtitulo: string; itens: string[]; bg: string; dot: string }) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-black/5">
      <div className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${bg}`}>
        <span className="text-xs font-bold uppercase tracking-wider text-white">{rotulo}</span>
        <span className="text-[10px] uppercase tracking-wider text-white/90">{subtitulo}</span>
      </div>
      <ul className="space-y-3 bg-muted/40 px-5 py-4">
        {itens.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
            <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${dot}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SwotComunicadorSection({ perfis }: { perfis: SwotComunicadorPorLetra[] }) {
  const S = SWOT_COMUNICADOR;
  const multiplas = perfis.length > 1;
  return (
    <Section>
      <h2 className="text-xl font-semibold">
        {S.titulo1} <span className="text-muted-foreground">{S.titulo2}</span>
      </h2>
      {multiplas && (
        <p className="mt-2 text-sm text-muted-foreground">{PERFIL_COMBINADO.aviso(perfis[0].letra, perfis[1].letra)}</p>
      )}
      {perfis.map(({ letra, swot }) => (
        <div key={letra} className="mt-5">
          {multiplas && (
            <span className="mb-3 inline-flex rounded-md bg-muted px-2.5 py-0.5 text-sm font-semibold tracking-[0.15em]">
              {letra}
            </span>
          )}
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${multiplas ? "mt-3" : ""}`}>
            <QuadranteSwot rotulo={S.forcasRotulo} subtitulo={S.forcasSubtitulo} itens={swot.forcas} bg="bg-emerald-600" dot="bg-emerald-600" />
            <QuadranteSwot rotulo={S.fragilidadesRotulo} subtitulo={S.fragilidadesSubtitulo} itens={swot.fragilidades} bg="bg-red-600" dot="bg-red-600" />
            <QuadranteSwot rotulo={S.oportunidadesRotulo} subtitulo={S.oportunidadesSubtitulo} itens={swot.oportunidades} bg="bg-blue-600" dot="bg-blue-600" />
            <QuadranteSwot rotulo={S.ameacasRotulo} subtitulo={S.ameacasSubtitulo} itens={swot.ameacas} bg="bg-amber-600" dot="bg-amber-600" />
          </div>
        </div>
      ))}
      <div className="mt-5 rounded-lg border-l-4 border-accent bg-accent/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">{S.comoLerTitulo}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{S.comoLerTexto}</p>
      </div>
    </Section>
  );
}

function ColunaGanhosPerdas({
  rotulo, corPilula, corTexto, ganha, perde,
}: { rotulo: string; corPilula: string; corTexto: string; ganha: string; perde: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-5 ring-1 ring-black/5">
      <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${corPilula}`}>
        {rotulo}
      </span>
      <p className={`mt-4 text-xs font-semibold uppercase tracking-wide ${corTexto}`}>{GANHOS_PERDAS.vocêGanha}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{ganha}</p>
      <p className={`mt-4 text-xs font-semibold uppercase tracking-wide ${corTexto}`}>{GANHOS_PERDAS.vocêPerde}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{perde}</p>
    </div>
  );
}

function GanhosPerdasSection({ perfis }: { perfis: GanhosPerdasPorLetra[] }) {
  const G = GANHOS_PERDAS;
  const multiplas = perfis.length > 1;
  return (
    <Section>
      <h2 className="text-xl font-semibold">
        {G.titulo1} <span className="text-muted-foreground">{G.titulo2}</span>
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{G.abertura}</p>
      {multiplas && (
        <p className="mt-1 text-sm text-muted-foreground">{PERFIL_COMBINADO.aviso(perfis[0].letra, perfis[1].letra)}</p>
      )}
      {perfis.map(({ letra, gp }) => (
        <div key={letra} className="mt-5">
          {multiplas && (
            <span className="mb-3 inline-flex rounded-md bg-muted px-2.5 py-0.5 text-sm font-semibold tracking-[0.15em]">
              {letra}
            </span>
          )}
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${multiplas ? "mt-3" : ""}`}>
            <ColunaGanhosPerdas rotulo={G.mantendoRotulo} corPilula="bg-emerald-600" corTexto="text-emerald-700" ganha={gp.mantendo.ganha} perde={gp.mantendo.perde} />
            <ColunaGanhosPerdas rotulo={G.mudandoRotulo} corPilula="bg-blue-600" corTexto="text-blue-700" ganha={gp.mudando.ganha} perde={gp.mudando.perde} />
          </div>
          <div className="mt-5 rounded-lg border-l-4 border-sky-400 bg-[#0B2239] p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">{G.fraseQueTeSeguraTitulo}</p>
            <p className="mt-2 text-base leading-relaxed text-white">{gp.frase_que_te_segura}</p>
          </div>
        </div>
      ))}
    </Section>
  );
}

function CartaoAplicacao({ situacao, automatico, tecnica, letra }: { situacao: string; automatico: string; tecnica: string; letra?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-5 ring-1 ring-black/5">
      <span className="inline-block rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
        {rotuloDaSituacao(situacao, letra)}
      </span>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{automatico}</p>
      <div className="mt-3 flex items-start gap-2">
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{ONDE_APARECE.tecnica}</p>
          <p className="text-sm font-medium text-foreground">{tecnica}</p>
        </div>
      </div>
    </div>
  );
}

function OndeApareceSection({ oa }: { oa: OndeAparece }) {
  const O = ONDE_APARECE;
  return (
    <Section>
      <h2 className="text-xl font-semibold">
        {O.titulo1} <span className="text-muted-foreground">{O.titulo2}</span>
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{O.abertura}</p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {oa.situacoes.map((s, i) => (
          <CartaoAplicacao key={i} situacao={s.situacao} automatico={s.automatico} tecnica={s.tecnica} letra={s.letra} />
        ))}
      </div>
    </Section>
  );
}

function ComunicadoresSemelhantesSection({ cs }: { cs: ComunicadoresSemelhantes }) {
  const C = COMUNICADORES_SEMELHANTES;
  return (
    <Section>
      <h2 className="text-xl font-semibold">
        {C.titulo1} <span className="text-muted-foreground">{C.titulo2}</span>
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{C.abertura}</p>
      <ul className="mt-5 space-y-3">
        {cs.pessoas.map((p, i) => (
          <li key={i} className="text-sm leading-relaxed text-foreground">
            <span className="font-semibold">{p.nome}</span>
            <span className="text-muted-foreground"> — {p.descricao}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-lg border-l-4 border-accent bg-accent/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">{C.ressalvaTitulo}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{C.ressalva}</p>
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
      {showIntro && <IntroSection isDisc={isDisc} isMbti={data.is_mbti} ipsativo={!!data.intensidade} />}

      {mostrar("fatores") && (data.intensidade ? (
        // DISC, Temperamentos e VAK (motor ipsativo): a página de intensidade no padrão da referência.
        <IntensidadeDoPerfil
          data={data}
          intensidade={data.intensidade}
          mostrarIndices={mostrar("derivados") && isDisc && !!data.derived}
        />
      ) : isDisc ? (
        <Section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{CORPO.naturalAdaptado}</h2>
            <p className="text-sm text-muted-foreground">
              {data.perfil_indefinido ? (
                <span>{CORPO.semPredominancia}</span>
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
                    natural {Math.round(f.natural_norm)} · adaptado {Math.round(f.adaptado_norm ?? 0)}
                    {data.external?.scores[f.key] != null && <> · externo {Math.round(data.external.scores[f.key])}</>}
                  </span>
                </div>
                <Bar value={f.natural_norm} color={f.color} label="Natural" />
                <Bar value={f.adaptado_norm ?? 0} color={f.color} label="Adaptado" faded />
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
      ) : data.is_mbti && data.mbti ? (
        // Oito barras soltas (E 100, I 0, N 100, S 0…) dizem a mesma coisa duas
        // vezes e escondem o que importa: a distância dentro de cada par.
        <EixosMbti jung={data.mbti} origem="teste" />
      ) : (
        <Section>
          <h2 className="text-lg font-semibold">{CORPO.intensidadePorDimensao}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{CORPO.intensidadeIntro}</p>
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
                    {CORPO.naoMedida}
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
          <h2 className="text-lg font-semibold">{CORPO.leituraDimensoes}</h2>
          <div className="mt-5 space-y-4">
            {rankedFactors.filter((f) => f.has_data !== false).map((f) => (
              <div key={f.id} className="rounded-lg border border-input p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: f.color ?? "var(--muted-foreground)" }} />
                    {f.label}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(f.natural_norm)} · {f.band_natural?.title ?? CORPO.semFaixa}
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

      {/* #302 — seções extras do DISC. Chave ausente no payload = seção some inteira, sem
          buraco visual (a sigla ainda não tem o conteúdo cadastrado, ou o instrumento não é DISC). */}
      {data.swot_comunicador && <SwotComunicadorSection perfis={data.swot_comunicador} />}
      {data.ganhos_perdas && <GanhosPerdasSection perfis={data.ganhos_perdas} />}
      {data.onde_aparece && <OndeApareceSection oa={data.onde_aparece} />}
      {data.comunicadores_semelhantes && <ComunicadoresSemelhantesSection cs={data.comunicadores_semelhantes} />}

      {mostrar("observadores") && data.external && (
        <Section>
          <h2 className="text-lg font-semibold">{OBSERVADORES.titulo}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Média das respostas de {data.external.count} observador(es) comparada à sua autoimagem.
          </p>
          <div className="mt-5 overflow-x-auto rounded-lg ring-1 ring-black/5">
            {/* Motor ipsativo (#288 Etapa 2c): você e os observadores no MESMO conjunto — o adaptado, que é o
                que a pessoa mostra e quem convive observa. O natural não entra aqui: está em outra régua. */}
            <table className={`w-full ${data.intensidade ? "min-w-[420px]" : "min-w-[520px]"} text-left text-sm`}>
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Fator</th>
                  {data.intensidade ? (
                    <th className="px-4 py-2 font-medium">Você (adaptado)</th>
                  ) : (
                    <>
                      <th className="px-4 py-2 font-medium">Natural</th>
                      <th className="px-4 py-2 font-medium">Adaptado</th>
                    </>
                  )}
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
                      {!data.intensidade && <td className="px-4 py-2">{Math.round(f.adaptado_norm ?? 0)}</td>}
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
              o externo está bem acima {data.intensidade ? "do seu gráfico adaptado" : "do natural"} em um fator, é
              provável que você venha entregando esse comportamento com mais intensidade do que reconhece — às vezes por
              exigência do contexto. Quando está bem abaixo, um traço que você considera evidente talvez não esteja
              chegando com clareza às pessoas.
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
            {s.body.split(/\n{2,}/).map((p, i) => <p key={i}>{comNegrito(p)}</p>)}
          </div>
        </Section>
      ))}

      {mostrar("narrativas") && isDisc && FACTOR_THEMES.map((theme) => {
        const f = byKey.get(theme.key);
        if (!f) return null;
        return (
          <Section key={theme.key}>
            <h2 className="text-lg font-semibold">{theme.title}</h2>
            {data.intensidade && (
              <p className="mt-1 text-xs text-muted-foreground">
                {CORPO.leituraDoAdaptado}
              </p>
            )}
            <div className="mt-4">
              {data.intensidade ? (
                // Motor ipsativo: a leitura deste fator vem do gráfico adaptado (o número de sempre), e o
                // natural não se põe ao lado dele — as duas barras juntas sugeriam a mesma régua.
                <Bar value={f.natural_norm} color={f.color} label="Adaptado" />
              ) : (
                <>
                  <Bar value={f.natural_norm} color={f.color} label="Natural" />
                  <Bar value={f.adaptado_norm ?? 0} color={f.color} label="Adaptado" faded />
                </>
              )}
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
                  {f.adaptacao.title ?? (f.gap_mode === "gap_up" ? CORPO.elevou : CORPO.conteve)}
                  {" "}({(f.gap ?? 0) > 0 ? "+" : ""}{f.gap ?? 0} pontos)
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.adaptacao.body}</p>
              </div>
            )}
          </Section>
        );
      })}

      {mostrar("narrativas") && isDisc && data.factors.some((f) => f.descritores.length > 0) && (
        <Section>
          <h2 className="text-lg font-semibold">{CORPO.reguaTitulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.intensidade
              ? CORPO.reguaAdaptado
              : CORPO.reguaNatural}
          </p>
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

      {mostrar("derivados") && isDisc && data.derived && (
        <DerivedSections d={data.derived} mbtiReal={mbtiReal ?? null} graficoAdaptado={!!data.intensidade} />
      )}

      {isDisc && (
        <Section>
          <h2 className="text-lg font-semibold">{CORPO.comunicacaoTitulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{CORPO.comunicacaoIntro}</p>
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
    fetchComSessao(`/api/public/action-plan/${responseId}`)
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
        const res = await fetchComSessao(`/api/public/action-plan/${responseId}`, {
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
      <p className="mt-1 text-sm text-muted-foreground">{CORPO.planoIntro}</p>
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
        {grave ? CONFIABILIDADE.tituloGrave : CONFIABILIDADE.tituloLeve}
      </p>
      <p className={`mt-1 text-sm leading-relaxed ${grave ? "text-amber-800" : "text-muted-foreground"}`}>
        {CONFIABILIDADE.corpo(q.motivos)}
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
        {RODAPE_LEGAL}
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

/**
 * Os quatro eixos de tipos psicológicos.
 *
 * Serve tanto para o teste próprio (`origem="teste"`) quanto para a estimativa
 * derivada do DISC (`origem="disc"`) — o selo em cima diz de onde veio, e essa
 * distinção é a regra de honestidade do relatório.
 */
export function EixosMbti({
  jung,
  origem,
}: {
  jung: { tipo: string; pares: JungPares };
  origem: "teste" | "disc";
}) {
  const doTeste = origem === "teste";
  // Abaixo de 55% num eixo de dois polos, a letra é praticamente sorteio.
  const indeciso = (p: JungPares[number]) => Math.max(p.leftPct, p.rightPct) < 55;
  // A sigla só vale como sigla quando as letras significam alguma coisa. Com
  // dois eixos no muro, "ENTJ" e "ISFJ" descrevem a MESMA pessoa — exibir uma
  // das duas é decidir na moeda e depois falar com convicção. É a mesma régua
  // que `report.server.ts` já aplica à síntese do MBTI respondido.
  const noMuro = jung.pares.filter(indeciso).length;
  const siglaVale = noMuro < 2;
  return (
    <Section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{JUNG.titulo}</h2>
        {siglaVale ? (
          <span className="rounded-md bg-muted px-3 py-1 text-sm font-semibold tracking-[0.2em]">{jung.tipo}</span>
        ) : (
          <span className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
            {JUNG.semSigla}
          </span>
        )}
      </div>
      <div className="mt-2">
        <SourceBadge>
          {doTeste ? JUNG.seloTeste : JUNG.seloDisc}
        </SourceBadge>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {doTeste
          ? JUNG.introTeste
          : JUNG.introDisc}
      </p>
      {!doTeste && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {comNegritoHerdado(JUNG.ressalvaDisc)}
        </p>
      )}
      {!siglaVale && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {JUNG.noMuro(noMuro)}
        </p>
      )}
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
            {indeciso(p) ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {JUNG.eixoEmpatado}
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {(JUNG_BULLETS[p.preferred] ?? []).map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function DerivedSections({
  d,
  mbtiReal,
  graficoAdaptado,
}: {
  d: Derived;
  mbtiReal?: { tipo: string; pares: JungPares } | null;
  /** Motor ipsativo: as derivações saem do gráfico adaptado, e o selo diz isso. */
  graficoAdaptado?: boolean;
}) {
  const jung = mbtiReal ?? d.jung;
  const selo = graficoAdaptado ? DERIVADOS.seloAdaptado : DERIVADOS.selo;
  // Uma série só quando não existe o segundo conjunto na mesma régua (motor ipsativo, #288 Etapa 2c).
  const umaSerie = d.competencias.every((c) => c.adaptado == null);

  return (
    <>
      <EixosMbti jung={jung} origem={mbtiReal ? "teste" : "disc"} />

      {/* Estilo de liderança */}
      <Section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{DERIVADOS.liderancaTitulo}</h2>
          <p className="text-sm text-muted-foreground">
            Dominante: <strong className="text-foreground">{d.dominant.label}</strong> ({Math.round(d.dominant.pct)}%)
          </p>
        </div>
        <div className="mt-2"><SourceBadge>{selo}</SourceBadge></div>
        <div className="mt-5 space-y-2">
          {d.leadership.map((s) => (
            <Bar key={s.key} value={s.pct} color={s.key === d.dominant.key ? NATURAL_COLOR : "var(--muted-foreground)"} label={s.label} faded={s.key !== d.dominant.key} />
          ))}
        </div>
        {(d.leadership_content.strengths || d.leadership_content.attention) && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {d.leadership_content.strengths && (
              <div className="rounded-lg border border-input p-4">
                <p className="text-sm font-semibold">{d.leadership_content.strengths.title ?? DERIVADOS.pontosFortes}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{d.leadership_content.strengths.body}</p>
              </div>
            )}
            {d.leadership_content.attention && (
              <div className="rounded-lg border border-input p-4">
                <p className="text-sm font-semibold">{d.leadership_content.attention.title ?? DERIVADOS.pontosAtencao}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{d.leadership_content.attention.body}</p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Mapa de competências */}
      <Section>
        <h2 className="text-lg font-semibold">{DERIVADOS.competenciasTitulo}</h2>
        <div className="mt-2"><SourceBadge>{selo}</SourceBadge></div>
        <p className="mt-3 text-sm text-muted-foreground">
          {umaSerie
            ? DERIVADOS.competenciasUmaSerie
            : DERIVADOS.competenciasDuasSeries}
        </p>
        <RadarChart items={d.competencias} rotuloUnico={umaSerie ? "Adaptado" : undefined} />
        <div className="mt-6 space-y-4">
          {d.competencias.map((c) => (
            <div key={c.name}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{c.name}</p>
                <span className="text-xs text-muted-foreground">
                  {umaSerie ? (
                    <>{Math.round(c.natural)} · <strong className="text-foreground">{c.band}</strong></>
                  ) : (
                    <>natural {Math.round(c.natural)} · adaptado {Math.round(c.adaptado ?? 0)} · <strong className="text-foreground">{c.band}</strong></>
                  )}
                </span>
              </div>
              {umaSerie ? (
                <Bar value={c.natural} color={NATURAL_COLOR} label="Adaptado" />
              ) : (
                <>
                  <Bar value={c.natural} color={NATURAL_COLOR} label="Natural" />
                  <Bar value={c.adaptado ?? 0} color={ADAPTADO_COLOR} label="Adaptado" faded />
                </>
              )}
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.definition}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Índices comportamentais */}
      <Section>
        <h2 className="text-lg font-semibold">{DERIVADOS.indicesTitulo}</h2>
        <div className="mt-2"><SourceBadge>{selo}</SourceBadge></div>
        <p className="mt-3 text-sm text-muted-foreground">{DERIVADOS.indicesIntro}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {d.indices.map((i) => (
            <div key={i.key} className="rounded-lg border border-input p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">{i.label}</p>
                {i.value != null && <span className="text-2xl font-medium tabular-nums">{i.value.toFixed(2)}</span>}
              </div>
              {i.value == null ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{INDICE_EM_REVISAO}</p>
              ) : (
                <>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${i.value * 100}%`, background: NATURAL_COLOR }} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{indexPhrase(i.key, i.value)}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

/** `rotuloUnico`: desenha só a série `natural` dos itens, com esse nome na legenda. */
export function RadarChart({ items, rotuloUnico }: { items: Derived["competencias"]; rotuloUnico?: string }) {
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
    items.map((it, i) => point(i, it[key] ?? 0).join(",")).join(" ");

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
        {!rotuloUnico && (
          <polygon points={poly("adaptado")} fill={ADAPTADO_COLOR} fillOpacity={0.18} stroke={ADAPTADO_COLOR} strokeWidth={2} strokeDasharray="6 4" />
        )}
        <polygon points={poly("natural")} fill={NATURAL_COLOR} fillOpacity={0.22} stroke={NATURAL_COLOR} strokeWidth={2} />
      </svg>
      <div className="mt-2 flex justify-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded" style={{ background: NATURAL_COLOR }} /> {rotuloUnico ?? "Natural"}
        </span>
        {!rotuloUnico && (
          <span className="flex items-center gap-2">
            <span className="inline-block h-1 w-6 rounded" style={{ background: ADAPTADO_COLOR, opacity: 0.7 }} /> Adaptado
          </span>
        )}
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
