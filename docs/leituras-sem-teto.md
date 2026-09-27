# Leituras que crescem com o uso — inventário (#314, 27/09/2026)

**A regra do projeto:** nenhuma leitura que pode crescer com o uso assume que cabe em uma consulta.
A API do banco (PostgREST do Supabase) devolve **no máximo 1.000 linhas** por consulta e corta o
resto **sem avisar** — `.limit()` e `.range()` não passam desse teto. O resultado vem com cara de
completo: a página não quebra, só falta seção, o total sai menor, o certificado não sai.

- Lista que cresce → `lerTodas` (`src/lib/ler-todas.ts`): lê em partes até o fim, com contagem exata.
- Quem **calcula** com as linhas (total, frequência, conclusão, ranking, texto de relatório) →
  `lerTodasOuRecusar`: se um dia não der para ler tudo, recusa com uma frase que a tela mostra —
  nunca entrega a fatia como se fosse o todo.
- A consulta precisa de **ordem estável terminando numa coluna única** (`.order("id")`, ou a chave
  primária composta, como `group_id, person_id` em `group_members`) — sem isso as páginas repetem
  ou pulam linhas.

## Tratadas na #314 (com prova acima de 1.000)

| Onde | O que lê | Prova |
|---|---|---|
| `report.server.ts` → `buildReport` (tela, PDF e bateria) | textos do relatório (`report_content`: 607 em 27/09) | `scripts/testar_leitura_sem_teto.py`: 1.057, 1.407 e 2.107 textos |
| `presenca.server.ts` → `montarTabelaPresenca` | presenças e turma do treinamento | turma fictícia: 21 alunos × 48 aulas = 1.008 presenças |
| `classroom.functions.ts` → `calcularConclusoesDoTreinamento` (certificado) | turma, presenças, aulas gravadas assistidas | idem |
| `learning.functions.ts` → `calcularConclusoesDaTrilha` (certificado) | aulas da trilha, alunos, marcações de "vista" | 2 alunos × 600 aulas = 1.200 marcações |
| `pontos.functions.ts` → `lerPontos` (ranking do grupo e "meus pontos") | pontos | 1.001 registros de 1 ponto |
| `painel.functions.ts` (Dashboard: panorama, Classroom, Academy, Comunidade, "quem está sumindo") | pessoas, grupos, membros, equipe, posts, comentários, pontos, aulas, presenças, aulas vistas, sessões | Dashboard da conta fictícia no motor do Cloudflare |
| `data.functions.ts` → `getDashboardStats` (topo do Dashboard) | testes enviados da conta | comparação do Dashboard real antes × depois |
| `data.functions.ts` → `listarPessoasParaEscolher` (o seletor de pessoas de 4 telas: novo evento da Agenda, "Criar mentoria", "Quem acessa" da Academy e "Liberar ou bloquear" da Biblioteca) | pessoas da conta | `scripts/testar_seletor_de_pessoas.py`: 1.050 pessoas, 350 com o MESMO nome — a consulta única trazia 1.000 (50 sumiam sem erro); em partes, 1.050 sem repetir nem faltar com páginas de 7, 100 e 1.000; a tela "Criar mentoria" lista as 1.050 |

Como provar de novo: `python3 scripts/testar_leitura_sem_teto.py criar|encher|turma|relatorio|pdf|esvaziar|apagar`
e `npx tsx scripts/testar_telas_sem_teto.ts fotografar|comparar|teto` (instruções no topo de cada um).

## Ainda sem tratar — ordem sugerida

Levantamento completo em 27/09 (≈ 90 leituras). Nenhuma está perto do teto na conta de hoje; o risco
cresce com o SaaS. Ficaram de fora por serem outras telas e outro assunto (regra 3: uma feature por vez).

**1. Criam dado errado quando cortam** (as mais graves — o corte não só mostra errado, GRAVA errado):
- `api.public.invite.$id.ts:109` e `convite.functions.ts:94` — procuram o e-mail entre TODAS as pessoas
  da conta em JavaScript; acima de 1.000 pessoas, não acham quem existe e **criam cadastro repetido**
  (ou não enviam o acesso).
- `data.functions.ts:988/1019` (`importPeople`) — decide quem já existe pela lista da conta: planilha
  grande duplica cadastro.
- `agendamento.functions.ts:495/1362` — horários ocupados do mentor: cortado, **horário ocupado aparece
  livre**; `:1607` (lembretes) — cortado, lembrete não sai.
- `duplicados.functions.ts:84/92` — compara pares de cadastros; cortado, os mais novos (os prováveis
  repetidos) somem, e pares já descartados voltam.

**2. Números de tela (tipo A):**
- `tests.functions.ts:1014/1046` (`getResponsesSummary`) — respostas × perguntas estoura cedo
  (36 respostas de um teste de 28 perguntas já passam de 1.000).
- `tests.functions.ts:52` (contador por versão), `:1332` (observadores), `:1493` (baterias),
  `:1630/1632` e `:1679/1683` (campanhas).
- `exportar-respostas.functions.ts:64` (respostas por teste) e `:236/258` (**planilha de respostas com
  célula vazia**).
- `data.functions.ts:727/733` (DNA do grupo), `:42` (lista de Pessoas e a contagem da tela).
- `classroom.functions.ts:218/245` (média de estrelas e "N concluíram" em `getTreinamento`).
- `comunidade.functions.ts:105/111` (curtidas e votos de enquete).
- `exportar.functions.ts:33/42` (planilha de pessoas e grupos).

**3. Listas (tipo L):** o feed da comunidade (`comunidade.functions.ts:89`, a base do feed, e `:102`
comentários), aba Envios (`tests.functions.ts:1313`), baterias (`:1484`), membros de grupo, mentorias, agenda do mês, certificados emitidos. (O seletor de
pessoas saiu desta lista: tratado no mesmo dia, ver a tabela acima.)

## Duas armadilhas que a paginação NÃO resolve

- **Lista de ids no endereço** (`.in("coluna", ids)`): vai na URL da requisição. Com centenas de ids a
  requisição falha por tamanho antes de chegar ao teto (falha visível, mas falha). Precisa fatiar a
  lista ou trocar por uma função no banco.
- **Somar no JavaScript o que o banco soma melhor**: ranking, contagens e totais leem todas as linhas
  só para somar. Paginar resolve a correção; em conta grande, uma função SQL com `sum`/`count` resolve
  também o tempo.

## Recado para a assistente do mentor (sessão própria)

`src/lib/assistente-mentor/dados.server.ts` tem dois avisos escritos quando as telas ainda cortavam:
o da lista de presença (linha ~327) nunca mais dispara, e o da trilha (linha ~433, "acima do que a
tela lê de uma vez") passa a disparar **à toa** acima de 1.000 marcações — a conclusão da trilha agora
lê tudo. Remover os dois na próxima demanda da assistente.
