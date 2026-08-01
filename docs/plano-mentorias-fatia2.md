# Menu Mentorias — Fatia 2: a voz do aluno

Escrito em 01/08/2026 com o Matheus. Continua `docs/plano-mentorias.md`, que
descreve a Fatia 1 (já no ar).

**O que esta fatia entrega:** o aluno avalia a sessão, comenta, e recebe os
arquivos que o professor anexar ao resumo.

---

## As três decisões do Matheus

**Estrelas, não NPS.** Nota de 1 a 5, como o Uber. A média é **satisfação**
(CSAT) e deve ser chamada assim na tela — nunca "NPS". NPS é outra pergunta
("de 0 a 10, o quanto recomendaria?") com outra conta (promotores menos
detratores). Chamar CSAT de NPS é o tipo de erro que queima numa reunião com
empresa cliente.

**Identificado.** O professor vê quem deu a nota e o que escreveu. Numa mentoria
individual o anônimo é ficção — só existe uma pessoa que poderia ter avaliado.

**Uma vez só.** Dado, não muda. A média fica estável e o histórico significa
alguma coisa. O custo assumido: quem clicar errado fica com a nota errada.

---

## 1. Modelo de dados

### `mentoria_sessoes` ganha três colunas

| Campo | O que é |
|---|---|
| `avaliacao_estrelas` | int, 1 a 5, nulo até o aluno avaliar |
| `avaliacao_comentario` | texto livre, opcional — dá para dar nota sem escrever |
| `avaliada_em` | timestamptz, quando o aluno avaliou |

Não precisa de tabela própria: a sessão é sempre 1:1, então há no máximo uma
avaliação por sessão.

### `mentoria_arquivos` — anexos do resumo

| Campo | O que é |
|---|---|
| `id` | uuid |
| `sessao_id` | de qual encontro |
| `mentor_id` | dono |
| `nome` | nome original do arquivo, para exibir |
| `caminho` | onde está no bucket |
| `tamanho_bytes` | int |
| `tipo` | mime |
| `created_at` | |

### Bucket `mentorias`

**Nasce privado, com link assinado** — não repetir o erro de `biblioteca` e
`avatares`, que nasceram públicos e custaram uma demanda cada para fechar.
Validade de 10 minutos, mesmo critério já decidido para material.

Limite de tamanho e tipos aceitos alinhados com a tela, como o commit
`98067cb` já corrigiu nos outros buckets.

---

## 2. As regras que não podem ser adivinhadas

**Só o aluno avalia.** O professor nunca tem permissão de escrever nessas três
colunas — vale garantir no banco, não só na tela.

**Só depois de concluída.** Sessão `agendada` não pode ser avaliada. O botão nem
aparece.

**Uma vez só, garantido no banco.** A permissão de escrita tem de exigir
`avaliacao_estrelas IS NULL`. Se ficar só na tela, o aluno reenvia por fora.

**Comentário é opcional.** Dar nota sem escrever tem de funcionar.

**Só o professor anexa arquivo.** O aluno baixa, nunca envia.

---

## 3. As telas

### Aluno — `/aluno/mentorias`

Na sessão concluída, abaixo do resumo: cinco estrelas e um campo de comentário.
Depois de enviar, vira leitura — mostra a nota que ele deu, sem botão de trocar.

Os arquivos anexados aparecem para baixar.

### Professor — `/mentorias/$id`

Cada sessão concluída mostra a nota e o comentário, **com o nome do aluno**.
Sessão ainda não avaliada mostra "aguardando avaliação".

No cabeçalho do pacote, ao lado da conta que já existe: **média de satisfação**
das sessões avaliadas, com quantas avaliações compõem. `4,5 (2 avaliações)` —
nunca uma média solta, que engana quando vem de um voto só.

No cartão de resumo, ao concluir: campo para anexar arquivos.

---

## 4. Fora desta fatia

O painel de métricas do professor (média de duração, quantas faltam agendar,
visão geral e individual) é a **Fatia 3**. Aqui entra só a média do pacote
aberto, que é barata e sai da mesma consulta.

Avaliar aula no Classroom é a **Fatia 5**.

---

## 5. Como saber que ficou pronto

Provado com login real, em produção:

- professor conclui uma sessão e anexa um arquivo;
- **aluno vê o arquivo, baixa, avalia com 4 estrelas e escreve um comentário** —
  este é o teste que decide;
- aluno tenta avaliar de novo, pela tela e pela rota direta: **negado**;
- aluno tenta avaliar uma sessão ainda agendada: **negado**;
- professor vê a nota, o comentário e o nome do aluno;
- a média no cabeçalho mostra o número certo e quantas avaliações tem;
- professor tenta avaliar por fora: **negado** (a nota é do aluno);
- link do arquivo copiado e aberto sem login depois de 10 minutos: **negado**.
