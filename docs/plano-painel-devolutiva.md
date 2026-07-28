# Painel de Devolutiva — mapeamento e plano

Mapeado em 28/07/2026 a partir do CIS Assessment (conta do Método Intenção,
`company.cisassessment.app/company/feedback/…`), a pedido do Matheus.

**Escopo do que foi copiado:** apenas a **arquitetura** — quais blocos existem,
como se organizam e que tipo de interação cada um pede. Nenhum texto
interpretativo deles foi transcrito. As metodologias são de domínio público; os
textos de relatório do CIS não são, e a regra do projeto continua sendo conteúdo
original (ver `CLAUDE.md`).

---

## 1. O que aquela tela é

Não é relatório e não é gestão. É a **ficha de trabalho da sessão**: a tela que
o mentor abre e compartilha com a pessoa durante a devolutiva.

A diferença que importa: **o plano de ação não é preenchido depois — é
construído durante a conversa, item por item, com a pessoa junto.**

É por isso que quase tudo ali é campo editável, não texto para ler.

---

## 2. Mapa completo

### 2.1 Controles de sessão

| Elemento | O que faz |
|---|---|
| Cronômetro flutuante | Estado (PAUSADA/rodando), `00:00:00`, iniciar/pausar, nome da pessoa |
| **Finalizar devolutiva** | Encerra a sessão — presumivelmente grava a duração |
| **Adicionar nota** | Anota algo no meio da conversa sem sair da tela |
| **Fazer download** | Exporta |
| Migalha | `Empresa / Devolutiva / [Nome] / Devolutiva` |

### 2.2 Cartões de resultado (grade de três colunas)

| Cartão | Forma |
|---|---|
| **Competências** | 16 itens em duas colunas, barra 0–100 colorida por faixa, alternador barra ↔ rosca |
| **Valores** | 6 barras horizontais com % |
| **MAAS** | Vazio: "Inventário não possui informações" |
| **Natural** | D/I/S/C em barras verticais |
| **Adaptado** | D/I/S/C em barras verticais |

### 2.3 Abas de trabalho — onde a devolutiva acontece

| Aba | Interação |
|---|---|
| **MEDOS** | Um cartão por medo. Nota **0–10** num slider + campo *"Escreva suas decisões aqui"* |
| **PONTOS A DESENVOLVER** | Checklist de comportamentos a evitar |
| **COMPETÊNCIAS** | *"Quais as principais competências para a realização de seus objetivos?"* — **selecione até 8** |
| **SWOT** | Forças / Fraquezas (verde/vermelho), cada quadrante com pergunta + campo livre |
| **LIVROS** | Recomendações com capa e sinopse, ligadas às competências mais baixas |

---

## 3. Onde já estamos

| Peça | Nosso estado |
|---|---|
| 16 competências | ✅ **idênticas**, nome por nome, em `derivations.ts` |
| Valores (6 de Spranger, %) | ✅ |
| Natural × Adaptado | ✅ |
| Estado vazio honesto | ✅ já é regra do projeto |
| Faixas por competência | ✅ Crítico/Baixo/Satisfatório/Desenvolvido/Excelente |
| Registro da devolutiva | ✅ tabela `devolutivas`, com `duration_min` |
| Plano de ação | ⚠️ existe (`action_plans`), mas são **6 perguntas abertas que a pessoa responde sozinha** |
| **Painel em cartões** | ❌ nosso relatório é documento longo de rolagem |
| Cronômetro de sessão | ❌ |
| Nota rápida na sessão | ❌ |
| Abas de trabalho | ❌ |
| Livros | ❌ |

**O buraco principal:** nosso plano de ação é um questionário que a pessoa
preenche depois, sozinha. O deles é construído na conversa. É a diferença entre
"aqui está seu relatório, reflita" e "vamos decidir juntos agora".

---

## 4. Plano

### Fase 1 — Painel de resultados (a base) — ✅ FEITO em 28/07/2026

Rota `/devolutivas/$id/painel`, aberta a partir da devolutiva agendada.

- Grade de cartões: um por instrumento **respondido**, lado a lado, cabendo numa
  tela. Instrumento não respondido aparece vazio e dito, como já fazemos.
- Cartões: Competências (16), Valores, Natural × Adaptado, e um por
  instrumento da bateria (Big Five, MBTI, Temperamentos, VAK).
- **Selo de confiabilidade no topo** — se a pessoa respondeu no automático, isso
  precisa estar na cara do mentor antes de ele interpretar qualquer coisa.
  Eles não têm isso.
- **O que ficou combinado na devolutiva anterior**, puxado do registro.
  Também não têm.

*Entregue: rota `/devolutivas/$id/painel`, botão "Painel" na devolutiva agendada.*

Verificado em produção com uma bateria de 4 inventários: a ressalva de
confiabilidade aparece antes dos números, os eixos empatados do MBTI são
declarados empatados, e cada inventário vira um cartão.

### Fase 2 — Cronômetro e nota rápida

- Cronômetro flutuante: iniciar / pausar / finalizar. Ao finalizar, grava
  `duration_min` e `completed_at` sozinho — hoje o mentor digita na mão.
- Botão de nota rápida: acrescenta uma linha ao `notes` sem sair da tela.

*Entrega: o registro da devolutiva passa a se preencher quase sozinho.*

### Fase 3 — Abas de trabalho (o plano de ação vira conversa)

Nova tabela `devolutiva_itens`: `devolutiva_id`, `tipo`, `chave`, `nota`,
`marcado`, `texto`. Uma linha por item trabalhado.

- **Medos** — derivados do DISC (já temos "Receios característicos" em
  `report_content`). Nota 0–10 + campo de decisão por medo.
- **Pontos a desenvolver** — checklist a partir dos nossos blocos existentes.
- **Competências-alvo** — escolher até 8 das 16, para focar o plano.
- **SWOT** — quatro quadrantes com campo livre.

*Entrega: o plano de ação deixa de ser questionário e vira acordo.*

### Fase 4 — Fechamento

- Exportar o painel preenchido em PDF, com a marca do mentor (já temos
  white label).
- Enviar por e-mail ao avaliado ao finalizar (Resend já está ligado).
- **Livros**: só faz sentido com um acervo curado. Fica por último e depende
  de você montar a lista — não dá para inventar recomendação.

---

## 5. Decisões que dependem do Matheus

1. **O plano de ação atual (6 perguntas) fica, sai ou vira a aba SWOT?**
   Hoje ele é respondido pelo avaliado sozinho, depois do relatório. Se as abas
   de trabalho entrarem, os dois se sobrepõem.
2. **Medos e pontos a desenvolver: usar o conteúdo que já temos**, derivado do
   DISC, ou escrever listas próprias para a devolutiva?
3. **Livros**: você tem uma lista de indicações por competência? Sem ela, essa
   aba não sai — e recomendação inventada é pior do que aba nenhuma.
4. **A devolutiva é sempre sobre uma bateria**, ou também sobre teste avulso?
   Muda quantos cartões o painel precisa aguentar.

---

## 6. Ordem sugerida

Fase 1 primeiro, sozinha. Ela já resolve o problema imediato — conduzir a
conversa sem rolar um documento de 13 mil caracteres — e é a que menos depende
de decisão sua. As fases 2 e 3 vêm depois, e a 3 é a que muda de verdade o
produto.
