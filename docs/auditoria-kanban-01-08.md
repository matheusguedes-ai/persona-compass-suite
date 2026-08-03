# Auditoria do kanban — 01/08/2026

Varredura independente feita pelo chat, em paralelo à do Claude Code, para
cruzar os dois resultados. 37 demandas abertas auditadas contra o código e o
banco. Não inclui as 19 nascidas das nossas conversas de 30/07–01/08, cujo
estado é sabido.

**Por que duas varreduras:** o kanban mentiu três vezes esta semana. Uma
auditoria que confirma a si mesma não prova nada; duas que chegam ao mesmo lugar
por caminhos diferentes, sim.

---

## Marcadas como pendentes, mas PRONTAS (4)

| # | Demanda | Prova |
|---|---|---|
| 30 | Notificar ao criar um evento | `gestao.functions.ts:238` e `:251`; três notificações `evento_novo` vivas no banco |
| 9 | Academy: layout em fileiras | `learning-catalog.tsx:105` e `:119`, já usado em cinco telas. Não há grade |
| 34 | Cortar a coluna Realizada por período | Resolvida por remoção: o Kanban de devolutivas saiu inteiro em `f10314a` |
| 51 | Mentor vê pontuação e ranking no grupo | Aba Ranking em `_app.grupos.$id.tsx:146`, render em `:251` |

## Parcialmente prontas (6) — hoje classificadas errado

| # | O que existe | O que falta |
|---|---|---|
| 92 | Agenda visual: a visão de MÊS existe (`agenda.tsx`) | a visão de semana; e clicar leva à lista, não à sessão |
| 108 | Selo aplicado nos layouts internos e nas 5 públicas principais | falta em `auth`, `criar-senha`, `aluno.criar-senha`, `checkin`, `convite-equipe` |
| 110 | Progresso e retomada dentro da trilha (`track-view.tsx`) | o card da trilha não mostra progresso — `listTracks` não agrega `learning_progress` |
| 50 | Painel do aluno lista pendentes e respondidos | o e-mail continua linkando direto ao teste (`email.functions.ts:99` e `:109`) |
| 102 | Código do convite inteiro e publicado | a prova de campo: `mandarConvite` não grava em `email_logs`, então só promovendo um parceiro real |
| 17 | "Teste da sincronização" já não existe | "Devolutiva · Painel Demo" (12/08) ainda está no Google Calendar |

## Abertas de verdade (26)

`#8` QI · `#31` `#32` `#33` notificações · `#49` design dos relatórios ·
`#52` perfil do aluno · `#53` `#54` `#55` `#56` comunidade · `#57` `#58` IA ·
`#59` `#60` integrações · `#62` Calendar para alunos · `#64` domínio ·
`#66` DMARC · `#67` Web Push · `#68` seleção pergunta a pergunta ·
`#69` testes automatizados · `#70` `.env` · `#71` `#72` dependem de dados ·
`#73` recorrência (é decisão de adiar, não construção) · `#97` a lista dele ·
`#113` setas nas prateleiras

## Inconclusiva (1)

`#61` — tela de consentimento do Google é Internal. Não existe em código nem
banco: é configuração do console, e o console pede senha. Indícios de que segue
Interno: `docs/google-calendar-passo-a-passo.md:17-27` e o fato de a única
conexão ser do próprio domínio.

---

## O que isto diz sobre o quadro

Quatro demandas prontas marcadas como pendentes, mais seis mal classificadas —
dez de trinta e sete, **27%**. Somadas às sete de Agenda descobertas antes, são
dezessete registros errados num quadro de duzentos e trinta e sete.

Não é descuido de quem registrou: é que ninguém voltava para conferir. O quadro
foi montado por varredura em 30/07 e desde então só recebeu entradas novas.

**A lição que fica é de processo, não de conteúdo:** demanda que ninguém
reconfere envelhece. Vale reauditar por amostragem a cada ciclo, em vez de
esperar acumular.
