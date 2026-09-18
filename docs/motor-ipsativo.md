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

## O que continua gravado do formato antigo — e sai na Etapa 2b

O relatório atual (`report.server.ts`, **não tocado** na 2a) lê estes campos, então o motor
continua gravando, com a fórmula antiga, exatamente como antes:

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
python3 scripts/testar_ipsativo.py vivo --app URL --versao ID [--aleatorio N]
                                               # pessoa descartável → endpoint público → confere → apaga tudo
```

`vivo` cria a resposta dentro de uma bateria com uma irmã pendente, o que impede o aviso "fulano
respondeu" (a bateria só notifica ao fechar) — o teste não toca o sino de ninguém — e apaga tudo
no `finally`, citando os ids antes. `--salvar-legado`/`--comparar-legado` comparam o motor antigo
com o novo sobre as **mesmas** respostas. Requer Node 22.6+ (lê o TypeScript direto) e, em produção,
User-Agent de navegador (o Cloudflare recusa o do Python).
