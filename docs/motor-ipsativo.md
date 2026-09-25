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
definição — e é por isso que existe o **sinal mínimo** abaixo.

## Sinal mínimo: quem pode ocupar o título (#292)

**sinal(letra) = quantas vezes ela foi MARCADA na resposta, somando MAIS e MENOS.**

Cada bloco só informa sobre DUAS letras: a marcada como mais e a marcada como menos. As outras ficam
mudas. Como `natural = máximo − MENOS`, uma letra quase nunca marcada sobe no ranking natural **sem
nunca ter sido escolhida** — lidera por ser invisível, não por ser forte. Foi o que apareceu na
resposta real de Temperamentos: Colérico marcado 8 vezes em 56 (3 como mais, 5 como menos) liderava o
natural enquanto o mesmo relatório dizia, abaixo, que era "o que menos aparece".

A regra: **letra com sinal abaixo do mínimo não ocupa o título**. O ranking NÃO muda — ela continua no
gráfico, marcada como "pouca informação" —, o título passa para a próxima com sinal suficiente, e sem
nenhuma elegível o perfil sai como "sem predominância clara" (`perfil.tipo = "sem_sinal"`). Vale nos
DOIS conjuntos: o problema é da medida, não de um dos gráficos.

O limiar sai da **própria estrutura do teste** (`sinalMinimo`), não de tabela: em cada bloco em que a
letra aparece, o acaso a marca com chance 2 × (alternativas dela) ÷ (alternativas do bloco); a soma é
uma binomial-poisson calculada exata, e o limiar é o primeiro sinal cuja cauda passa de
`ALVO_SINAL_POR_LETRA` (2%). Conferido com 40 mil respostas ao acaso por instrumento
(`python3 scripts/testar_ipsativo.py sinal`):

| instrumento | letras × blocos | sinal médio | limiar | marca alguma letra | muda o título |
|---|---|---|---|---|---|
| DISC | 4 × 28 | 14 | < 9 | 7,2% | 6,9% (natural) · 0,1% (adaptado) |
| Temperamentos | 4 × 28 | 14 | < 9 | 7,2% | 6,9% · 0,1% |
| VAK | 3 × 24 | 16 | < 11 | 3,2% | 3,2% · 0,1% |
| Valores | 6 × 30 (cada letra em 15) | 10 | < 6 | 5,0% | 4,5% · 0,0% |

O alvo "menos de 5% ao acaso" fecha em VAK e Valores. No DISC e no Temperamentos ele cairia em 8, e aí
o caso real (Colérico com sinal 8) escaparia: 9 é o limiar que atende os dois lados, com 6,9% ao acaso
— e "ao acaso" é o pior caso, porque quem responde ao acaso não tem perfil mesmo. `sem_sinal` é
inalcançável nos instrumentos de hoje (as marcações somam 2 × blocos, então alguma letra sempre passa).

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
  "versao": 2,
  "n_blocos": 28,
  "limiares": { "combinado_ate": 2, "moderada_ate": 5, "sinal_alvo_por_letra": 0.02 },
  "letras": [                       // NA ORDEM DO INSTRUMENTO (D, I, S, C), não do ranking
    { "dimension_id": "…", "chave": "S", "maximo": 28, "mais": 12, "menos": 2,
      "sinal": 14, "sinal_minimo": 9, "sinal_suficiente": true,
      "adaptado": { "bruto": 12, "percentual": 42.857, "posicao": 1, "empate_com_anterior": false },
      "natural":  { "bruto": 26, "percentual": 30.952, "posicao": 1, "empate_com_anterior": false },
      "expressao": 10 },
    …
  ],
  "adaptado": {
    "soma_bruta": 28,
    "ranking": ["S", "C", "I", "D"],
    "perfil": { "tipo": "predominante", "chaves": ["S"], "codigo": "S", "distancia": 3,
                "faixa": "moderada", "grupo_da_frente": ["S"], "empate_multiplo": false,
                "fora_por_sinal": [] }
  },
  "natural": {
    "soma_bruta": 84,
    "ranking": ["S", "C", "I", "D"],
    "perfil": { "tipo": "combinado", "chaves": ["S", "C"], "codigo": "SC", "distancia": 2,
                "faixa": "combinado", "grupo_da_frente": ["S", "C"], "empate_multiplo": false,
                "fora_por_sinal": [] }   // letras que o ranking traria e o sinal segurou (#292)
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
  Letra sem **sinal mínimo** (#292) não entra na sigla: sai marcada como "pouca informação" nos dois
  gráficos, e a tela explica em uma frase por que aquela dimensão não dá para posicionar.
- **Dois gráficos separados**, NATURAL e ADAPTADO, cada um com a **própria sigla** e o **percentual da
  soma do próprio conjunto** (as letras de um gráfico somam 100), letras na ordem do instrumento. Nada
  compara um com o outro. Os observadores (360°) aparecem só no ADAPTADO: é o mesmo conjunto (vezes
  MAIS), o que a pessoa mostra e quem convive observa.
- **Os três índices lado a lado** (só DISC): Positividade, Estima e Flexibilidade, cada um com a linha
  que diz o que ele significa (`INTENSIDADE.indiceExplica`). Refeitos na #304 — ver "Os índices (#304)".
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

## Os índices (#304)

Positividade, Estima e Flexibilidade (página de intensidade) e Energia (bloco "Índices
comportamentais"). Só DISC — Temperamentos e VAK não mostram índice. Código: `src/lib/indices.ts`
(função pura sobre o `ipsativo`); oráculo independente: `scripts/indices_oraculo.py`.

**O que estava errado.** Positividade e Energia aplicavam pesos que somam 1 (ex.: 0,6·I + 0,25·S +
0,15·D) ao percentual de cada letra no gráfico adaptado — só que no motor ipsativo as quatro letras
DIVIDEM 100 (média 25). A conta não passava de 0,60 nem para quem marcasse a mesma letra nos 28 blocos
e ficava perto de 0,25 para todo mundo: **abaixo de 0,40 em 100% (Positividade) e 99,9% (Energia) das
respostas ao acaso** — o achado registrado desde a 2c, confirmado. O número vinha do motor, não do
bloco antigo; mas é o mesmo número (as vezes MAIS), por isso o bloco antigo parecia o culpado. Estima
e Flexibilidade estavam "em revisão" desde a 2c. É a mesma causa que dá ISFP a todo mundo nos Tipos
Psicológicos estimados e comprime liderança e competências — esses NÃO foram mexidos na #304.

**As contas** (DISC: 28 blocos, uma alternativa por letra em cada bloco):

| índice | conta | leitura |
|---|---|---|
| Positividade | MENOS em D e C ÷ total de MENOS | Marston (1928): I e S respondem a um ambiente percebido como favorável; D e C, como desafiador |
| Energia | MENOS em S e C ÷ total de MENOS | o outro eixo de Marston: D e I agem sobre o ambiente; S e C o acolhem |
| Estima | Σ MAIS × nota do estilo na ordem de ACEITAÇÃO ÷ Σ MAIS | o quanto o que a pessoa mostra vem do que ela menos rejeita em si |
| Flexibilidade | pares de estilos com a ordem do MAIS contrária à ordem de ACEITAÇÃO ÷ pares | o quanto ela está reorganizando o jeito natural para o ambiente |

`aceitação = 1 − MENOS ÷ (maximo − MAIS)`: das vezes em que o estilo ainda estava disponível depois do
MAIS, em quantas não foi rejeitado. Nota na ordem: 1 para o mais aceito, 0 para o menos, empate = meia
posição. Empate de um lado só num par = meia troca. Estima e Flexibilidade deixam de fora a letra com
sinal abaixo do mínimo (#292) — o teste não consegue posicioná-la, e posição é o que elas comparam.
Sem valor (`null`, tela diz por quê) só no caso patológico de quem marca o MESMO estilo como MAIS nos
28 blocos. Flexibilidade trocou de sentido em relação à conta antiga: **alto = está ajustando
bastante** (o que a palavra diz); a frase do bloco de índices mudou junto.

**Por que Estima e Flexibilidade NÃO comparam os dois gráficos.** O natural é "blocos − MENOS", e o
estilo marcado como MAIS num bloco não pode ser o MENOS daquele bloco: letra por letra, **natural ≥
MAIS, sempre** — o que a pessoa mais mostra sobe sozinho no natural. Medido: comparando a ordem dos
dois gráficos, a "Flexibilidade" de quem responde ao acaso (mediana 0,33) saía MAIOR que a de quem de
fato ajusta metade da ordem (mediana 0,00), e a "Estima" subia com o ajuste. A aceitação desconta os
blocos em que o estilo não podia ser rejeitado; com ela os dois índices andam na direção certa.
⚠️ Isso também vale para o próprio gráfico natural (o estilo mais escolhido como MAIS tende a subir
nele por construção) — o motor NÃO foi mudado aqui; fica registrado para quando se revisar o natural.

**Calibração** (`python3 scripts/testar_indices.py simular`, 40 mil respostas ao acaso na estrutura real):

| índice | p5 | mediana | p95 | abaixo de 0,40 | 0,40–0,70 | acima de 0,70 |
|---|---|---|---|---|---|---|
| Positividade | 0,36 | 0,50 | 0,64 | 17% | 81% | 2% |
| Estima | 0,39 | 0,50 | 0,62 | 6% | 94% | 0% |
| Flexibilidade | 0,08 | 0,50 | 0,83 | 35% | 47% | 18% |
| Energia | 0,36 | 0,50 | 0,64 | 17% | 81% | 2% |

Ninguém no extremo por acaso — quem responde sem perfil fica no meio. Com PESSOAS SIMULADAS (natural
sorteado; adaptado = natural + ajuste de tamanho conhecido), Positividade acompanha a orientação
natural verdadeira (correlação 0,73–0,85) e se espalha por 0,04–0,96; quando o ajuste cresce, a
Flexibilidade sobe (mediana 0,17 → 0,33; acima de 0,70: 0,5% → 9,9%) e a Estima desce (abaixo de 0,40:
0,3% → 18%), com correlação ~0,4 com o ajuste verdadeiro — 28 blocos não dão mais que isso. Variantes
testadas e descartadas por medir pior: suavizar a aceitação para poucos blocos; exigir disponibilidade
mínima; Estima pela fração dos MAIS nos dois estilos mais aceitos.

As faixas das frases (abaixo de 0,40 / 0,40–0,70 / acima) foram mantidas. Na referência CIS do dono
(outro instrumento, outro momento), os três índices vão de 0,17 a 0,87 entre 6 pessoas — termômetro de
escala, não alvo. Resposta real do dono em 25/09: Positividade 0,61 · Estima 0,40 · Flexibilidade 0,75
· Energia 0,64 (natural I, adaptado C: o que ele mais mostra, C, é o que ele mais rejeita quando pode).

```
python3 scripts/testar_indices.py puro            # TypeScript × oráculo: casos feitos à mão + milhares de respostas
python3 scripts/testar_indices.py simular         # a calibração acima
python3 scripts/testar_indices.py real --app URL  # respostas reais: oráculo × o que o relatório entrega
```

## O que continua gravado do formato antigo — e quando sai

Ainda gravado, com a fórmula antiga, exatamente como antes — só para quem ainda o lê (relatórios de
Valores, Big Five, MBTI, QI e personalizados, e a tela pós-envio `/responder`). Sai quando o último
leitor migrar; enquanto Valores não entrar no motor, o formato antigo continua existindo para ele.
⚠️ **E o DNA do grupo** (`getGroupDna`, `src/lib/data.functions.ts`) lê `normalized.natural` de TODAS
as respostas, inclusive DISC, Temperamentos e VAK — no DISC, a média das vezes MAIS (o conjunto que o
`ipsativo` chama de adaptado). Achado na #304, que por isso NÃO removeu o bloco nem nos instrumentos
ipsativos: sem o DNA passar a ler o `ipsativo`, parar de gravar esvaziaria a tela do grupo.

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
python3 scripts/testar_ipsativo.py sinal       # calibração do sinal mínimo (#292): distribuição e limiar por instrumento
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
