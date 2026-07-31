# Proposta de revisão do teste de QI

Preparado na madrugada de 31/07/2026, por instrução explícita: **não executar**,
só levantar o que uma revisão precisa tratar e propor o caminho. O gabarito
(quais perguntas entram, qual é a resposta certa de cada uma) é decisão do
Matheus — aqui só está o que a investigação encontrou e como testar depois.

## O que existe hoje

`test_versions` → `QI — Template Padrão` (`instrument_id = 'qi'`), 20 perguntas
`multiple_choice`, cada uma com 4 alternativas e uma dimensão só (`QI Total`).
A opção certa vale 1 ponto; as erradas não valem nada — sem penalidade por
errar, sem meia pontuação por eliminação.

Os 20 enunciados cobrem três famílias, misturadas sem padrão fixo de posição
entre elas:

- **sequência numérica** (7 perguntas): `2, 4, 6, 8, ...`, `1, 4, 9, 16, 25,
  ...`, etc.
- **analogia verbal** (4 perguntas): `Livro está para Biblioteca assim como
  Quadro está para: ___`.
- **lógica/matemática** (9 perguntas): silogismo (`Todos os pintores usam
  tinta. João é pintor. Logo:`), problema de regra de três, parentesco,
  ordenação.

## Dois achados concretos (não é só "não foi revisado")

### 1. A posição da resposta certa não está balanceada

Contei a posição (1ª a 4ª alternativa) da opção certa nas 20 perguntas:

| Posição | Quantas vezes | % |
|---|---|---|
| 1ª | 2 | 10% |
| **2ª** | **9** | **45%** |
| 3ª | 6 | 30% |
| 4ª | 3 | 15% |

Quem clicasse sempre na **2ª alternativa**, sem ler nenhuma pergunta, acertaria
9 de 20 (45%) — o suficiente pra cair na faixa "40–69,99", uma faixa de
resultado plausível, por pura posição. É exatamente o defeito que a revisão de
28/07 achou e corrigiu nos outros seis testes (`revisao-perguntas-dos-testes.md`
na memória): ordem fixa nas alternativas fabrica resultado. Reembaralhar essas
20 perguntas com posição balanceada (cada posição correta ~5 vezes em 20) é o
primeiro passo mecânico de qualquer revisão, antes até de mexer no conteúdo.

### 2. As faixas de resultado não têm texto

`test_result_bands` tem 5 faixas cadastradas (0–19,99 / 20–39,99 / 40–69,99 /
70–89,99 / 90–100), todas com o campo de texto **vazio** (`NULL`). Ou seja: se
alguém responder o QI hoje, o relatório mostra o número da pontuação e nada
para interpretá-la — diferente dos outros seis testes, que têm texto por
faixa. Isso não é questão de conteúdo "não revisado", é uma lacuna funcional:
o teste pode ser respondido e pontuado, mas o relatório sai incompleto.

## O que uma revisão de verdade precisa decidir (perguntas para o Matheus, não para mim)

- **O nome "QI".** Um instrumento de 20 itens, sem validação psicométrica
  (sem amostra normativa, sem estudo de confiabilidade), chamando-se "QI" —
  a mesma sigla de testes como WAIS e Raven, que passam por décadas de
  validação — arrisca o avaliado interpretar um número aqui como diagnóstico
  de verdade. Vale manter "QI" com uma ressalva clara no relatório (como o
  MBTI já tem "estimativa derivada"), ou trocar o nome para algo como
  "Raciocínio Lógico" que não empresta a legitimidade de um instrumento que
  este não é? Isso muda o texto do relatório inteiro, não só as perguntas.
- **As faixas de corte.** 0–19,99 / 20–39,99 / 40–69,99 / 70–89,99 / 90–100
  parecem números redondos, não uma curva normal calculada — não há amostra
  real ainda para normar de verdade (mesma limitação que o Big Five/DISC têm
  hoje, documentada em `roadmap-proximas-features.md`). Sem dado real, a
  faixa é sempre uma aposta; a pergunta é que critério usar até ter amostra
  (ex.: quantos acertos "deveria" ser cada faixa, dado que são 20 perguntas
  de dificuldade variada).
- **Dificuldade e viés cultural.** As analogias verbais (`Escuro está para
  Claro assim como Silêncio está para: ___`) e os problemas com nome próprio
  (`Marina comprou...`, `Ana é mais alta que Bia...`) dependem de vocabulário
  e contexto — vale filtrar por isso, mas é leitura de conteúdo, não algo que
  eu decido sozinho.

## Caminho sugerido para quando o Matheus revisar

Mesma receita que já funcionou nos outros seis testes
(`scripts/conteudo_disc.py` e companhia): um script Python com o conteúdo
final e `assert` no topo conferindo as regras antes de gravar. Para o QI,
os asserts релevantes seriam:

```python
# cada posição (0 a 3) deve ser a certa entre 4 e 6 vezes em 20 perguntas
from collections import Counter
contagem = Counter(posicao_da_certa for _, _, posicao_da_certa in PERGUNTAS)
assert all(4 <= contagem[p] <= 6 for p in range(4)), contagem

# toda pergunta com o texto da faixa de resultado preenchido
assert all(faixa["texto"].strip() for faixa in FAIXAS)
```

Depois de rodar, provar com `scripts/simular_resposta.py <versao> primeira`
e `... ultima` — a mesma prova que os outros testes já usam: acertar sempre a
"primeira alternativa" ou sempre a "última" não pode dar resultado melhor que
o esperado pelo acaso.

Nada neste documento foi aplicado ao banco — é só o levantamento e a proposta,
para o Matheus decidir o gabarito e o enquadramento quando quiser tocar nisso.
