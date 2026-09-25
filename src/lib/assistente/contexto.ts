/**
 * O RELATÓRIO EM TEXTO, PARA A ASSISTENTE (#289, Nível 1).
 *
 * A assistente só pode falar do que está ESCRITO no relatório do aluno. Então ela recebe
 * exatamente isso: cada relatório passado por aqui vira texto na MESMA ordem e com as MESMAS
 * condições de `ReportBody` (a tela) e de `montarBlocosDoCorpo` (o PDF) — o que o mentor escondeu
 * nas Configurações (`settings.hidden_blocks`) fica de fora aqui também, e os textos fixos vêm de
 * `textos.ts`, a fonte única que a tela e o PDF já usam. Nada aqui recalcula nota ou sigla.
 *
 * Função pura e determinística: a mesma entrada devolve os mesmos bytes, porque este texto é o
 * prefixo que fica em cache na API (qualquer byte diferente — uma data "de agora", uma ordem que
 * varia — faria cada pergunta pagar o relatório inteiro de novo).
 *
 * Duas escolhas de leitura, iguais às da tela:
 * - na régua de descritores entra só a faixa DESTACADA de cada fator — é o que o relatório diz da
 *   pessoa; as outras 17 frases de cada régua são a escala, não o resultado;
 * - se o aluno respondeu o inventário de tipos psicológicos de verdade, a estimativa derivada do
 *   DISC sai (o relatório da bateria faz a mesma troca).
 */
import type { Derived, Factor, JungPares, Report } from "@/components/report/sections";
import type { GraficoDoConjunto } from "@/lib/intensidade";
import { JUNG_BULLETS, indexPhrase } from "@/lib/derivations";
import { rotuloDaSituacao } from "@/lib/disc-secoes-extra";
import { INDICES_DA_INTENSIDADE } from "@/lib/indices";
import {
  COMUNICACAO,
  COMUNICADORES_SEMELHANTES,
  CONFIABILIDADE,
  CORPO,
  DERIVADOS,
  FACTOR_THEMES,
  FAIXA_DO_GRAFICO,
  GANHOS_PERDAS,
  INDICE_SEM_VALOR,
  INTENSIDADE,
  INTRO,
  JUNG,
  OBSERVADORES,
  ONDE_APARECE,
  PERFIL_COMBINADO,
  RODAPE_LEGAL,
  SECTION_TITLES,
  SWOT_COMUNICADOR,
  avisoDeSinal,
} from "@/components/report/textos";

const semNegrito = (t: string) => t.replace(/\*\*([^*]+)\*\*/g, "$1");
const n = (v: number) => String(Math.round(v));
const dataBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem data";

function bloco(titulo: string, linhas: Array<string | null | undefined | false>): string {
  const corpo = linhas.filter((l): l is string => typeof l === "string" && l.trim() !== "");
  return corpo.length ? `## ${titulo}\n${corpo.join("\n")}` : "";
}

function grafico(nome: string, explica: string, g: GraficoDoConjunto, externo?: Record<string, number> | null): string[] {
  const titulo = g.sigla
    ? `${nome}: sigla ${g.sigla} (${g.faixa ? FAIXA_DO_GRAFICO[g.faixa] : "sem faixa"})`
    : `${nome}: sem sigla — sem predominância clara`;
  return [
    titulo,
    `  Como se lê: ${explica}`,
    ...g.letras.map((l) => {
      const marcas = [l.na_sigla ? "entra na sigla" : null, l.pouca_informacao ? `marcada como "${INTENSIDADE.poucaInformacao}"` : null]
        .filter(Boolean)
        .join("; ");
      const ext = externo?.[l.key] != null ? ` · percepção externa ${n(externo[l.key])}` : "";
      return `  - ${l.label} (${l.key}): ${n(l.percentual)}${marcas ? ` — ${marcas}` : ""}${ext}`;
    }),
  ];
}

function eixosMbti(jung: { tipo: string; pares: JungPares }, doTeste: boolean): string {
  const indeciso = (p: JungPares[number]) => Math.max(p.leftPct, p.rightPct) < 55;
  const noMuro = jung.pares.filter(indeciso).length;
  return bloco(JUNG.titulo, [
    doTeste ? JUNG.seloTeste : JUNG.seloDisc,
    noMuro < 2 ? `Tipo: ${jung.tipo}` : `Tipo: ${JUNG.semSigla}. ${JUNG.noMuro(noMuro)}`,
    doTeste ? JUNG.introTeste : JUNG.introDisc,
    doTeste ? null : semNegrito(JUNG.ressalvaDisc),
    ...jung.pares.map((p) => {
      const cabeca = `- ${p.left} ${n(p.leftPct)}% × ${p.right} ${n(p.rightPct)}%`;
      if (indeciso(p)) return `${cabeca}: ${JUNG.eixoEmpatado}`;
      const bullets = (JUNG_BULLETS[p.preferred] ?? []).map((b) => `    · ${b}`).join("\n");
      return `${cabeca} — preferência: ${p.preferred}${bullets ? `\n${bullets}` : ""}`;
    }),
  ]);
}

function derivados(d: Derived, mbtiReal: { tipo: string; pares: JungPares } | null, graficoAdaptado: boolean): string[] {
  const selo = graficoAdaptado ? DERIVADOS.seloAdaptado : DERIVADOS.selo;
  const umaSerie = d.competencias.every((c) => c.adaptado == null);
  return [
    mbtiReal ? eixosMbti(mbtiReal, true) : eixosMbti(d.jung, false),
    bloco(`${DERIVADOS.liderancaTitulo} (${selo})`, [
      `Dominante: ${d.dominant.label} (${n(d.dominant.pct)}%)`,
      ...d.leadership.map((s) => `- ${s.label}: ${n(s.pct)}%`),
      d.leadership_content.strengths &&
        `${d.leadership_content.strengths.title ?? DERIVADOS.pontosFortes}: ${d.leadership_content.strengths.body}`,
      d.leadership_content.attention &&
        `${d.leadership_content.attention.title ?? DERIVADOS.pontosAtencao}: ${d.leadership_content.attention.body}`,
    ]),
    bloco(`${DERIVADOS.competenciasTitulo} (${selo})`, [
      umaSerie ? DERIVADOS.competenciasUmaSerie : DERIVADOS.competenciasDuasSeries,
      ...d.competencias.map((c) =>
        umaSerie
          ? `- ${c.name}: ${n(c.natural)} (${c.band}) — ${c.definition}`
          : `- ${c.name}: natural ${n(c.natural)}, adaptado ${n(c.adaptado ?? 0)} (${c.band}) — ${c.definition}`,
      ),
    ]),
    // Os índices saem das escolhas de MAIS e MENOS (#304), não do gráfico adaptado: selo neutro, como na tela.
    bloco(`${DERIVADOS.indicesTitulo} (${DERIVADOS.selo})`, [
      DERIVADOS.indicesIntro,
      ...d.indices.map((i) =>
        i.value == null ? `- ${i.label}: ${INDICE_SEM_VALOR}` : `- ${i.label}: ${i.value.toFixed(2)} — ${indexPhrase(i.key, i.value)}`,
      ),
    ]),
  ];
}

/**
 * Um relatório, na ordem de `ReportBody`. `mbtiReal` = o tipo do inventário de tipos psicológicos
 * que o aluno respondeu de verdade, quando existe — substitui a estimativa derivada do DISC.
 */
export function textoDoRelatorio(r: Report, mbtiReal: { tipo: string; pares: JungPares } | null): string {
  const isDisc = r.is_disc !== false;
  // A frase que a tela mostra no perfil combinado — e, para quem lê só o texto, de onde vêm as letras:
  // as seções herdadas seguem a sigla do gráfico NATURAL (a do título "PERFIL"), nunca a do adaptado.
  const avisoCombinado = (letras: string[]) =>
    letras.length > 1
      ? `${PERFIL_COMBINADO.aviso(letras[0], letras[1])} (As letras são as do perfil natural, ${letras.join("")}.)`
      : null;
  const oculto = r.settings?.hidden_blocks ?? [];
  const mostrar = (b: string) => !oculto.includes(b);
  const ranked = [...r.factors].sort((a, b) => b.natural_norm - a.natural_norm);
  const partes: string[] = [];

  if (r.qualidade && r.qualidade.nivel !== "alta") {
    partes.push(
      bloco(r.qualidade.nivel === "baixa" ? CONFIABILIDADE.tituloGrave : CONFIABILIDADE.tituloLeve, [
        CONFIABILIDADE.corpo(r.qualidade.motivos),
      ]),
    );
  }

  const intro = r.is_mbti
    ? INTRO.mbti
    : isDisc
      ? [...INTRO.disc, r.intensidade ? INTRO.discIpsativo : INTRO.discClassico]
      : INTRO.dimensional;
  partes.push(bloco(INTRO.titulo, intro.map(semNegrito)));

  if (mostrar("fatores")) {
    const it = r.intensidade;
    if (it) {
      const indices =
        isDisc && mostrar("derivados") && r.derived
          ? INDICES_DA_INTENSIDADE.map((k) => r.derived?.indices.find((i) => i.key === k)).filter(
              (i): i is Derived["indices"][number] => i != null,
            )
          : [];
      partes.push(
        bloco(INTENSIDADE.rotulo, [
          it.perfil.sigla
            ? `PERFIL ${it.perfil.sigla}${it.perfil.labels.length ? ` — ${it.perfil.labels.join(" · ")}` : ""}`
            : INTENSIDADE.semPredominancia,
          !it.perfil.sigla && (it.natural.tipo === "sem_sinal" ? INTENSIDADE.semSinal : INTENSIDADE.empateMultiplo),
          ...indices.map((i) =>
            i.value == null
              ? `Índice ${i.label}: ${INDICE_SEM_VALOR}`
              : `Índice ${i.label}: ${i.value.toFixed(2)} — ${INTENSIDADE.indiceExplica[i.key]}`,
          ),
          indices.length > 0 && INTENSIDADE.indicesRodape,
          ...grafico(INTENSIDADE.naturalTitulo, INTENSIDADE.naturalExplica, it.natural),
          ...grafico(INTENSIDADE.adaptadoTitulo, INTENSIDADE.adaptadoExplica, it.adaptado, r.external?.scores ?? null),
          `${INTENSIDADE.reguasTitulo}: ${INTENSIDADE.reguasSeparadas}`,
          it.sinal_baixo.length > 0 && avisoDeSinal(it.sinal_baixo, it.marcacoes_no_teste),
          r.external &&
            `Percepção externa (no gráfico adaptado) baseada em ${r.external.count} observador(es)${r.external.respondents.length ? `: ${r.external.respondents.join(", ")}` : ""}.`,
          it.texto && it.perfil.sigla
            ? it.texto.estado === "publicado"
              ? `${it.texto.titulo ?? `Sobre o perfil ${it.perfil.sigla}`}:\n${semNegrito(it.texto.corpo)}`
              : `Sobre o perfil ${it.perfil.sigla}: ${INTENSIDADE.textoPendente}`
            : null,
          r.is_disc === false && INTENSIDADE.leiturasDoAdaptado,
        ]),
      );
    } else if (isDisc) {
      partes.push(
        bloco(CORPO.naturalAdaptado, [
          r.perfil_indefinido
            ? CORPO.semPredominancia
            : `Perfil composto: ${r.profile}${r.profile_labels.length ? ` · ${r.profile_labels.join(" + ")}` : ""}`,
          ...r.factors.map(
            (f) =>
              `- ${f.label} (${f.key}): natural ${n(f.natural_norm)} · adaptado ${n(f.adaptado_norm ?? 0)}` +
              (r.external?.scores[f.key] != null ? ` · externo ${n(r.external.scores[f.key])}` : ""),
          ),
        ]),
      );
    } else if (r.is_mbti && r.mbti) {
      partes.push(eixosMbti(r.mbti, true));
    } else {
      partes.push(
        bloco(CORPO.intensidadePorDimensao, [
          CORPO.intensidadeIntro,
          ...ranked.map((f) =>
            f.has_data === false
              ? `- ${f.label} (${f.key}): ${CORPO.naoMedida}`
              : `- ${f.label} (${f.key}): ${n(f.natural_norm)}` +
                (r.external?.scores[f.key] != null ? ` · externo ${n(r.external.scores[f.key])}` : ""),
          ),
        ]),
      );
    }
  }

  if (mostrar("fatores") && !isDisc && ranked.some((f) => f.band_natural)) {
    partes.push(
      bloco(
        CORPO.leituraDimensoes,
        ranked
          .filter((f) => f.has_data !== false)
          .map(
            (f) =>
              `- ${f.label}: ${n(f.natural_norm)} · ${f.band_natural?.title ?? CORPO.semFaixa}` +
              (f.band_natural?.description ? `\n  ${f.band_natural.description}` : ""),
          ),
      ),
    );
  }

  if (r.swot_comunicador) {
    const S = SWOT_COMUNICADOR;
    partes.push(
      bloco(`${S.titulo1} ${S.titulo2} (Matriz SWOT do Comunicador)`, [
        avisoCombinado(r.swot_comunicador.map((x) => x.letra)),
        ...r.swot_comunicador.map(({ letra, swot }) =>
          [
            r.swot_comunicador!.length > 1 ? `Letra ${letra}:` : null,
            `${S.forcasRotulo} (${S.forcasSubtitulo}): ${swot.forcas.join("; ")}`,
            `${S.fragilidadesRotulo} (${S.fragilidadesSubtitulo}): ${swot.fragilidades.join("; ")}`,
            `${S.oportunidadesRotulo} (${S.oportunidadesSubtitulo}): ${swot.oportunidades.join("; ")}`,
            `${S.ameacasRotulo} (${S.ameacasSubtitulo}): ${swot.ameacas.join("; ")}`,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
        `${S.comoLerTitulo}: ${S.comoLerTexto}`,
      ]),
    );
  }

  if (r.ganhos_perdas) {
    const G = GANHOS_PERDAS;
    partes.push(
      bloco(`${G.titulo1} ${G.titulo2}`, [
        G.abertura,
        avisoCombinado(r.ganhos_perdas.map((x) => x.letra)),
        ...r.ganhos_perdas.map(({ letra, gp }) =>
          [
            r.ganhos_perdas!.length > 1 ? `Letra ${letra}:` : null,
            `${G.mantendoRotulo} — ${G.vocêGanha}: ${gp.mantendo.ganha} ${G.vocêPerde}: ${gp.mantendo.perde}`,
            `${G.mudandoRotulo} — ${G.vocêGanha}: ${gp.mudando.ganha} ${G.vocêPerde}: ${gp.mudando.perde}`,
            `${G.fraseQueTeSeguraTitulo}: ${gp.frase_que_te_segura}`,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      ]),
    );
  }

  if (r.onde_aparece) {
    const O = ONDE_APARECE;
    partes.push(
      bloco(`${O.titulo1} ${O.titulo2}`, [
        O.abertura,
        ...r.onde_aparece.situacoes.map(
          (s) => `- ${rotuloDaSituacao(s.situacao, s.letra)}: ${s.automatico} ${O.tecnica}: ${s.tecnica}`,
        ),
      ]),
    );
  }

  if (r.comunicadores_semelhantes) {
    const C = COMUNICADORES_SEMELHANTES;
    partes.push(
      bloco(`${C.titulo1} ${C.titulo2}`, [
        C.abertura,
        ...r.comunicadores_semelhantes.pessoas.map((p) => `- ${p.nome} — ${p.descricao}`),
        `${C.ressalvaTitulo}: ${C.ressalva}`,
      ]),
    );
  }

  if (mostrar("observadores") && r.external) {
    const ext = r.external;
    partes.push(
      bloco(OBSERVADORES.titulo, [
        `Média das respostas de ${ext.count} observador(es) comparada à autoimagem.`,
        ...r.factors.map((f: Factor) => {
          const e = ext.scores[f.key];
          const dif = e == null ? "—" : `${Math.round(e - f.natural_norm) > 0 ? "+" : ""}${Math.round(e - f.natural_norm)}`;
          const voce = r.intensidade
            ? `você (adaptado) ${n(f.natural_norm)}`
            : `natural ${n(f.natural_norm)}, adaptado ${n(f.adaptado_norm ?? 0)}`;
          return `- ${f.label}: ${voce} · externo ${e == null ? "—" : n(e)} · diferença ${dif}`;
        }),
        ...OBSERVADORES.paragrafos(!!r.intensidade),
      ]),
    );
  }

  if (mostrar("narrativas")) {
    for (const s of r.sections) {
      partes.push(bloco(s.title ?? SECTION_TITLES[s.section] ?? s.section, [semNegrito(s.body)]));
    }
  }

  if (mostrar("narrativas") && isDisc) {
    const byKey = new Map(r.factors.map((f) => [f.key, f]));
    for (const theme of FACTOR_THEMES) {
      const f = byKey.get(theme.key);
      if (!f) continue;
      partes.push(
        bloco(theme.title, [
          r.intensidade
            ? `${CORPO.leituraDoAdaptado} Adaptado: ${n(f.natural_norm)}`
            : `Natural: ${n(f.natural_norm)} · Adaptado: ${n(f.adaptado_norm ?? 0)}`,
          f.band_natural && `${f.band_natural.title}${f.band_natural.description ? ` — ${f.band_natural.description}` : ""}`,
          f.adaptacao &&
            `${f.adaptacao.title ?? (f.gap_mode === "gap_up" ? CORPO.elevou : CORPO.conteve)} (${(f.gap ?? 0) > 0 ? "+" : ""}${f.gap ?? 0} pontos): ${f.adaptacao.body}`,
        ]),
      );
    }
    if (r.factors.some((f) => f.descritores.length > 0)) {
      partes.push(
        bloco(CORPO.reguaTitulo, [
          r.intensidade ? CORPO.reguaAdaptado : CORPO.reguaNatural,
          ...r.factors.map((f) => {
            const ativos = f.descritores.filter((d) => d.active).map((d) => d.body);
            return `- ${f.label}: ${ativos.length ? ativos.join(", ") : "nenhuma faixa destacada"}`;
          }),
        ]),
      );
    }
  }

  if (mostrar("derivados") && isDisc && r.derived) {
    partes.push(...derivados(r.derived, mbtiReal, !!r.intensidade));
  }

  if (isDisc) {
    partes.push(
      bloco(CORPO.comunicacaoTitulo, [CORPO.comunicacaoIntro, ...COMUNICACAO.map((c) => `- ${c.label}: ${c.body}`)]),
    );
  }

  return partes.filter(Boolean).join("\n\n");
}

export type RelatorioDoAluno = { report: Report; submittedAt: string };

/**
 * O bloco inteiro que vai para a assistente: todos os relatórios do aluno, do mais recente ao
 * mais antigo. Recebe só relatórios que o ALUNO pode ver — quem decide isso é quem chama.
 */
export function contextoDoAluno(nome: string | null, relatorios: RelatorioDoAluno[]): string {
  const mbtiReal = relatorios.find((x) => x.report.is_mbti && x.report.mbti)?.report.mbti ?? null;
  const corpo = relatorios
    .map(({ report, submittedAt }) => {
      const cabeca = `<relatorio teste="${report.test_title ?? "Teste"}" concluido_em="${dataBR(submittedAt)}">`;
      return `${cabeca}\n${textoDoRelatorio(report, report.is_disc !== false ? mbtiReal : null)}\n</relatorio>`;
    })
    .join("\n\n");
  return [
    "<relatorios_do_aluno>",
    nome ? `Aluno: ${nome}` : null,
    `Estes são os relatórios que este aluno vê na plataforma — o resultado mais recente de cada teste que ele respondeu (${relatorios.length}). Junto com o bloco <plataforma_do_aluno>, é todo o material que você tem sobre ele.`,
    `Aviso que acompanha todo relatório: ${RODAPE_LEGAL}`,
    "",
    corpo,
    "</relatorios_do_aluno>",
  ]
    .filter((l) => l !== null)
    .join("\n");
}
