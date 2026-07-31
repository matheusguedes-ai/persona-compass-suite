# Menu Mentorias — especificação da Fatia 1

Escrito em 31/07/2026 com o Matheus. Substitui o menu Devolutivas.

**O contexto que mudou tudo:** a plataforma nasceu para ser um clone do CIS —
dispara teste, entrega relatório. Durante a construção virou outra coisa: um
**hub** onde o Matheus resolve tudo num lugar só. Devolutiva era uma feature de
plataforma de teste. Mentoria é uma feature de hub. Por isso ela sai de dentro
de Testes e vira menu de primeiro nível.

---

## O que esta fatia entrega, e por que ela é indivisível

Cinco peças. Nenhuma serve sozinha — é o ciclo inteiro ou nada:

```
criar mentoria → agendar sessão → marcar concluída → escrever o resumo → o aluno recebe
```

Fora desta fatia, de propósito: link de auto-agendamento, avaliação por
estrelas, NPS, arquivos no resumo, comentário do aluno, painel de métricas,
avaliação de aula no Classroom. Cada um está no kanban.

---

## 1. Modelo de dados

Três tabelas novas. Todas nascem com dono (`mentor_id`), conforme a regra 2 da
constituição.

### `mentorias` — o pacote

| Campo | O que é |
|---|---|
| `id` | uuid |
| `mentor_id` | dono da conta — `acting_account()` |
| `person_id` | o aluno |
| `titulo` | opcional, o Matheus nomeia se quiser ("Mentoria de comunicação") |
| `sessoes_contratadas` | int — quantas foram vendidas |
| `observacoes` | texto livre |
| `status` | `ativa` · `encerrada` |
| `created_at` / `updated_at` | |

**Aumentar o pacote é editar `sessoes_contratadas`.** Fechou 5, vendeu mais 3,
vira 8. Não se cria um pacote novo — foi pedido explicitamente.

### `mentoria_sessoes` — cada encontro

| Campo | O que é |
|---|---|
| `id` | uuid |
| `mentoria_id` | a que pacote pertence |
| `mentor_id` | dono (redundante de propósito: simplifica a RLS) |
| `quando` | timestamptz — data e hora de início |
| `termina_em` | timestamptz — fim previsto |
| `modalidade` | `presencial` · `online` |
| `local` | endereço, quando presencial |
| `link_url` | link da chamada, quando online |
| `status` | `agendada` · `concluida` · `cancelada` |
| `duracao_real_min` | int — **o professor informa ao concluir**, alimenta a média |
| `resumo` | texto do pós-mentoria |
| `concluida_em` | quando o professor marcou |

### `mentoria_tarefas` — o checklist do pós

| Campo | O que é |
|---|---|
| `id` | uuid |
| `sessao_id` | de qual encontro |
| `mentor_id` | dono |
| `titulo` | o professor nomeia o checklist inteiro? não — **cada item tem seu texto** |
| `ordem` | int |
| `concluida` | bool — **só o aluno marca** |
| `concluida_em` | timestamptz |

O nome do checklist, se o professor quiser dar um, vai num campo
`checklist_titulo` na própria sessão. Uma tabela a menos.

---

## 2. As regras que não podem ser adivinhadas

**Só o professor marca a sessão como concluída.** Nunca o aluno. É o que libera
o cartão de resumo.

**Só o aluno marca o checklist.** O professor cria os itens; quem risca é quem
faz. Se o professor pudesse marcar, o checklist viraria relatório dele.

**O resumo só existe depois de concluída.** Antes disso o campo nem aparece.

**O professor edita o resumo a qualquer momento**, inclusive depois de salvo.

**Salvar o resumo publica para o aluno na hora** — e dispara notificação pelo
sino, que já existe.

**A conta do pacote é calculada, nunca digitada.** Realizadas = sessões
concluídas. Agendadas = sessões `agendada` com data futura. Faltam agendar =
`sessoes_contratadas` − concluídas − agendadas. Este é o mesmo princípio que já
rege a fila de devolutivas hoje: *o que se digita à mão, se esquece de atualizar*.

---

## 3. As telas

### Professor — `/mentorias`

Lista de pacotes ativos. Cada linha: aluno, título, e a conta do pacote em três
números (**realizadas · agendadas · faltam agendar**), mais a data do próximo
encontro.

Botão **Criar**: abre um diálogo com aluno, quantidade de sessões, título
opcional e observações. Criação livre — sem modelos pré-definidos, foi pedido.

### Professor — `/mentorias/$id`

O pacote aberto. Cabeçalho com a conta. Lista de sessões em ordem de data.

Botão **Agendar sessão**: data, hora de início e fim, modalidade
(presencial/online) e, conforme a escolha, endereço ou link da chamada.

Cada sessão agendada tem **Marcar como concluída** → abre o cartão de resumo:
duração real em minutos, texto do resumo, nome do checklist (opcional) e os
itens. Salvar publica para o aluno.

### Aluno — `/aluno/mentorias`

**O aluno não executa nada além do checklist.** Vê as sessões agendadas com data,
modalidade e link/endereço; vê o resumo das concluídas; e marca os itens do
checklist.

Não pode agendar, não pode concluir, não pode editar resumo.

---

## 4. O que sai do caminho

**A aba Devolutivas sai de dois lugares:** do menu Testes
(`src/components/abas-testes.tsx`) e da tela do grupo.

**O painel de devolutiva** (`src/components/painel-devolutiva.tsx`, cartões de
DISC/competências/valores) **é removido.** Decisão do Matheus em 31/07:
aproveitar a base de código onde for viável, e remover por completo onde não for.
Não vale manter uma tela parecida em dois lugares.

**A tabela `devolutivas` tem 1 registro** (conferido no banco em 31/07). Não há
histórico a preservar. A permissão de colaborador `devolutivas` é renomeada para
`mentorias`, e quem tiver a antiga migra.

**Consequência no kanban:** as demandas #35 a #49 descreviam o painel de
devolutiva mapeado do CIS. Com esta decisão, elas deixam de existir como estão.
O que sobrevive é o princípio — *o plano é construído na conversa, não respondido
sozinho depois* —, que aqui vira o checklist do pós-mentoria.

---

## 5. Como saber que ficou pronto

Provado com login real, nos três papéis:

- professor cria pacote de 3 sessões, agenda uma, ela aparece como agendada e a
  conta diz 0 realizadas · 1 agendada · 2 a agendar;
- professor conclui a sessão, informa 50 minutos, escreve o resumo e cria 2
  itens de checklist;
- **aluno entra e vê o resumo e os dois itens** — este é o teste que decide;
- aluno marca um item; o professor vê marcado;
- aluno **não consegue** concluir sessão nem editar resumo, nem pela tela nem
  colando a rota;
- colaborador sem a permissão `mentorias` é barrado — menu e rota;
- professor aumenta o pacote de 3 para 5 e a conta se ajusta sozinha.
