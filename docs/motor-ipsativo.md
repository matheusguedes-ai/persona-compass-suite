# Motor ipsativo da escolha forçada (#288 — Etapa 2a)

Decisão de produto (Matheus + chat, 18/09/2026): teste de escolha forçada é medida
**ipsativa**. Só faz sentido em **posição relativa entre as letras da mesma pessoa** —
nunca em porcentagem absoluta contra um limiar fixo do tipo "67% é alto".

Código: [`src/lib/escolha-forcada.ts`](../src/lib/escolha-forcada.ts) (função pura, sem banco) e
`computeAndStore` em `src/routes/api.public.response.$id.ts` (monta a entrada e grava a saída).
Testes: `scripts/testar_ipsativo.py` (ver o fim deste arquivo).

## Por que não porcentagem

Em cada bloco a pessoa marca **um MAIS e um MENOS**. O que uma letra ganha, outra perde: as
pontuações das letras sempre somam o mesmo total (28 MAIS em 28 blocos). Logo a média entre as
letras é fixa (25% no DISC) e "67% é alto" mede a régua, não a pessoa — para chegar lá a pessoa
teria de marcar a mesma letra em 19 dos 28 blocos; ao acaso isso acontece 2 vezes em 1 milhão.

## As contas (por letra)

| campo | conta | faixa | leitura |
|---|---|---|---|
| **adaptado** | vezes que a letra foi **MAIS** | 0 a n_blocos | o que a pessoa busca / mostra |
| **natural** | n_blocos − vezes que a letra foi **MENOS** | 0 a n_blocos | quanto menos rejeitada, mais natural |
| **expressão** | MAIS − MENOS | soma zero entre as letras | "buscada ou evitada no dia a dia" — métrica **separada** |

Natural e adaptado são **dois conjuntos independentes**. Cada um é reportado como **ranking**
(1º, 2º, 3º, 4º) e como **% da soma do próprio conjunto** (cada conjunto soma 100 dentro de si).
Os dois percentuais **não estão na mesma régua**: nunca subtrair um do outro nem escrever
"sua adaptação é maior que seu natural" — esse foi o viés que causou o bug "adaptação sempre
crescente" (natural% tinha média 25 e adaptado% tinha média 50, então a diferença já nascia +25).
Por isso o resultado **não tem nenhum campo de diferença** entre os dois.

Propriedade a saber: uma letra que a pessoa **nunca** marcou (nem MAIS nem MENOS) fica com
natural = n_blocos (a mais "natural", porque nunca rejeitada) e adaptado = 0. É consequência da
definição, não bug.

## Perfil e intensidade (para cada conjunto, separadamente)

`distância = bruto(1º) − bruto(2º)`, em pontos brutos:

| distância | resultado | `faixa` |
|---|---|---|
| 0 a 2 | **perfil combinado** (as duas letras, ex.: `SC`) — sem faixa de intensidade | `combinado` |
| 3 a 5 | perfil de uma letra, **predominância moderada** | `moderada` |
| 6 ou mais | perfil de uma letra, **predominância clara** | `clara` |

Limiares: `LIMITE_COMBINADO = 2` e `LIMITE_MODERADA = 5`, vindos da variação esperada por acaso
em 28 escolhas. **Não mudar sem avisar o dono do produto.** Quem responde ao acaso no DISC cai
em: adaptado 66,5% combinado · 27,9% moderada · 5,6% clara (natural 74,3 · 24,0 · 1,7) — ou
seja, "clara" é rara por acaso. Em VAK (3 letras, 24 blocos) a "clara" por acaso sobe para
9,7%; em Valores (6 letras, 3 alternativas por bloco) os mesmos limiares são apertados demais
(84% combinado por acaso). `python3 scripts/testar_ipsativo.py simular` refaz a conta.

**Empate múltiplo.** A regra pede "as duas letras". Quando 3 ou 4 letras estão a até 2 pontos
da 1ª (ex.: 7-7-7-7), o perfil de duas letras esconde um empate maior:
`grupo_da_frente` lista todas e `empate_multiplo = true` avisa. A tela deve tratar esse caso
(por exemplo, "sem predominância clara") — o motor só registra o fato.

## Desempate: sempre determinístico

Todo empate se decide pela **ordem da letra no instrumento** (`sort_order` da dimensão, depois a
chave, depois o id) — **nunca** pela ordem em que o banco devolveu as linhas. Toda leitura do
motor tem `.order()` explícito. Isso não é excesso de zelo: **editar uma linha no lugar muda a
posição física dela no banco**, e no DISC novo (cópia por fork, editada na Etapa 1) as perguntas
já saem do banco fora da ordem da tela.

## O que fica gravado: `computed_scores.ipsativo`

Só para os instrumentos em `INSTRUMENTOS_IPSATIVOS` (**DISC, Temperamentos, VAK**). Exemplo
(DISC; MAIS: S 12, C 9, I 5, D 2 · MENOS: D 13, I 9, C 4, S 2), abreviado:

```jsonc
"ipsativo": {
  "versao": 1,
  "n_blocos": 28,
  "limiares": { "combinado_ate": 2, "moderada_ate": 5 },
  "letras": [                       // NA ORDEM DO INSTRUMENTO (D, I, S, C), não do ranking
    { "dimension_id": "…", "chave": "S", "maximo": 28, "mais": 12, "menos": 2,
      "adaptado": { "bruto": 12, "percentual": 42.857, "posicao": 1, "empate_com_anterior": false },
      "natural":  { "bruto": 26, "percentual": 30.952, "posicao": 1, "empate_com_anterior": false },
      "expressao": 10 },
    …
  ],
  "adaptado": {
    "soma_bruta": 28,
    "ranking": ["S", "C", "I", "D"],
    "perfil": { "tipo": "predominante", "chaves": ["S"], "codigo": "S", "distancia": 3,
                "faixa": "moderada", "grupo_da_frente": ["S"], "empate_multiplo": false }
  },
  "natural": {
    "soma_bruta": 84,
    "ranking": ["S", "C", "I", "D"],
    "perfil": { "tipo": "combinado", "chaves": ["S", "C"], "codigo": "SC", "distancia": 2,
                "faixa": "combinado", "grupo_da_frente": ["S", "C"], "empate_multiplo": false }
  }
}
```

Este é o **único** lugar que as telas devem ler. Ranking, percentuais, perfil, faixa e expressão
já vêm prontos: quem lê **não recalcula nada** (recalcular é como nascem duas regras diferentes).
`codigo` junta as chaves sem separador quando todas têm 1 caractere (`SC`) e com `+` nos demais
(`SAN+COL`, Temperamentos).

## Quem lê o `ipsativo` (Etapas 2b-i e 2c)

O **relatório** (`report.server.ts`) de **DISC, Temperamentos e VAK** lê o `ipsativo` e **não lê
mais** `total`/`natural`/`adaptado`/`normalized` — nem os do avaliado nem os dos observadores 360°.
Prova: apagar esses campos de uma resposta de teste não muda o relatório (nem com o `ipsativo`
gravado, nem com ele apagado também). Valores, Big Five, MBTI, QI e testes personalizados **não**
passam pelo motor ipsativo, continuam lendo o formato antigo (por isso ele ainda é gravado) e o
relatório deles sai idêntico ao de antes, byte a byte.

- **De onde vem o resultado** (`src/lib/ipsativo.server.ts`): do campo gravado; ou, para respostas
  **anteriores à 2a** (as reais de Temperamentos e VAK não têm o campo), **derivado em memória** das
  respostas cruas (`test_answers`) pela MESMA função `calcularIpsativo`. Nada é gravado: resposta
  existente não se altera. Se as respostas cruas estiverem incompletas, o resultado é `null` e o
  relatório diz "não gera relatório detalhado" — não inventa.
- **A ponte temporária da 2b-i morreu na 2c.** Não existe mais, em lugar nenhum do relatório, o
  "adaptado" antigo — (MAIS − MENOS + máximo) ÷ (2 × máximo) — nem a diferença natural × adaptado, a
  "adaptação crescente/decrescente" e o texto que nascia dela.

### A página de intensidade (Etapa 2c) — `src/lib/intensidade.ts`

No padrão da referência que o dono do produto usa (cartão #288.3, relatórios CIS):

- **"PERFIL <sigla>"** com a sigla do gráfico **NATURAL** (`natural.perfil.codigo`): uma letra quando
  há predominância, duas na ordem do ranking quando é perfil combinado ("CI" ≠ "IC"). **Empate
  múltiplo** no natural (três ou mais letras a até 2 pontos da 1ª) → "Sem predominância clara",
  decisão do dono do produto. A capa, o painel do aluno e a bateria mostram o mesmo perfil.
- **Dois gráficos separados**, NATURAL e ADAPTADO, cada um com a **própria sigla** e o **percentual da
  soma do próprio conjunto** (as letras de um gráfico somam 100), letras na ordem do instrumento. Nada
  compara um com o outro. Os observadores (360°) aparecem só no ADAPTADO: é o mesmo conjunto (vezes
  MAIS), o que a pessoa mostra e quem convive observa.
- **Os três índices lado a lado** (só DISC). Positividade segue calculada; **Estima e Flexibilidade
  ficam "em revisão"**: as duas subtraíam o adaptado antigo do natural antigo — réguas misturadas — e,
  pela conta, davam **1,00 e 0,75 para qualquer resposta de DISC** (verificado em 20 mil respostas).
  Voltam quando o dono do produto definir um cálculo novo (`computeDerived(natural, null)`).
- **Texto do perfil** — conteúdo cadastrável em `report_content`, seção `<instrumento>_perfil_texto`,
  `dimension_key` = a sigla, `mode = 'natural'`, coluna `status` (`publicado` | `pendente`). Texto da
  versão (`version_id`) vence o da plataforma. Sem linha, pendente ou com corpo vazio → **aviso** de
  que a descrição está sendo preparada, nunca texto inventado. Fonte e travas (inclusive contra frase
  copiada da referência): `scripts/conteudo_perfil_texto.py`. Padrão de redação: uma letra → descrição
  corrida; duas compatíveis → integrada; duas em tensão (DISC: DS, SD, IC, CI) → anuncia a combinação e
  diz quando cada lado aparece.

### O resto do relatório depois da 2c (até a demanda do relatório completo)

- **Seções escritas por perfil (DISC)**: pela **letra que lidera a sigla natural** — o relatório não
  pode declarar "PERFIL CI" e descrever D logo abaixo. Os textos de combinação dessas seções (CI, DS…)
  nunca foram revisados pelo dono e não são usados.
- **Leituras por fator** (faixas, descritores, derivações, seções dimensionais de Temperamentos/VAK,
  360°): seguem no **conjunto ADAPTADO**, com os mesmos números de sempre — as faixas e os pesos foram
  calibrados para ele, e o natural (percentual comprimido: no DISC nunca passa de 33%) não cabe nelas.
  A tela diz isso ("gráfico adaptado") onde mostra esses números. No payload, o campo continua se
  chamando `natural_norm` (herança do formato antigo) e `adaptado`/`adaptado_norm`/`gap` vêm `null`.
- Antes × depois, campo a campo: `python3 scripts/comparar_relatorios.py capturar|comparar`.

## O que continua gravado do formato antigo — e quando sai

Ainda gravado, com a fórmula antiga, exatamente como antes — só para quem ainda o lê (relatórios de
Valores, Big Five, MBTI, QI e personalizados, e a tela pós-envio `/responder`). Sai quando o último
leitor migrar; enquanto Valores não entrar no motor, o formato antigo continua existindo para ele:

- `computed_scores.total`, `.natural`, `.adaptado`, `.normalized` (0–100).
  ⚠️ **Nome enganoso:** aqui `natural` = só os MAIS (a conta que o `ipsativo` chama de
  `adaptado`), e `normalized.natural`/`.adaptado` estão em réguas diferentes (média 25 × 50).
- `computed_scores.qualidade` (selo de confiabilidade). Único ajuste desta etapa: a "mania de
  posição" agora é medida na **ordem da tela** (antes: ordem física do banco, errada em versões
  copiadas por fork).
- A tela pós-envio (`/responder`) continua lendo `result.dominant`, `result.band`,
  `per_dimension_bands` e `by_dimension` da resposta do POST (não do banco). `result.band` segue
  com o defeito conhecido (bruto contra faixas 0–100 → sempre "baixa"); a 2b substitui.
- **Colunas `dominant_dimension_id` e `result_band_id`:** ninguém as lia (Etapa 0). Nos
  instrumentos ipsativos **deixaram de ser gravadas** (ficam `NULL`) — o perfil mora no
  `ipsativo`. Nos demais instrumentos seguem como sempre.

## Valores

Usa o **mesmo tipo de pergunta** (`forced_choice`: 30 blocos, 6 letras, 3 alternativas por
bloco), mas **ficou fora** por decisão pendente: o motor não grava `ipsativo` nele e nada do que
ele grava mudou (só o desempate do `dominant` legado, agora pela ordem da letra). Para incluí-lo:
acrescentar `"valores"` a `INSTRUMENTOS_IPSATIVOS`. Antes disso, decidir os limiares (com 6
letras e 3 alternativas por bloco o `maximo` de cada letra é ~15 e 2/5 pontos são muito apertados).

## Como testar

```
python3 scripts/testar_ipsativo.py puro        # cálculo real × oráculo em Python: casos do produto + milhares de respostas aleatórias nas estruturas reais + determinismo (só lê o banco)
python3 scripts/testar_ipsativo.py simular     # quem responde ao acaso: % em combinado / moderada / clara
python3 scripts/testar_ipsativo.py vivo --app URL --versao ID [--aleatorio N] [--etapa2c]
                                               # pessoa descartável → endpoint público → confere → apaga tudo
                                               # --etapa2c: confere a página de intensidade contra o que o motor gravou
                                               # --manter ARQ: não apaga (conferir na tela); depois `limpar --arquivo ARQ`
node scripts/testar_intensidade.mjs            # a função da página de intensidade sobre o motor real (só lê o banco)
python3 scripts/conteudo_perfil_texto.py       # travas dos textos do perfil; `aplicar` grava o que falta
```

`vivo` cria a resposta dentro de uma bateria com uma irmã pendente, o que impede o aviso "fulano
respondeu" (a bateria só notifica ao fechar) — o teste não toca o sino de ninguém — e apaga tudo
no `finally`, citando os ids antes. `--salvar-legado`/`--comparar-legado` comparam o motor antigo
com o novo sobre as **mesmas** respostas. Requer Node 22.6+ (lê o TypeScript direto) e, em produção,
User-Agent de navegador (o Cloudflare recusa o do Python).
