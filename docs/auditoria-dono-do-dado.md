# Auditoria — o dono do dado em tudo que já existe

Feita em 12/08/2026. Demanda `#214` do kanban, Fase 6 do `docs/roadmap-fases.md`.
Fonte: `list_tables` do Supabase (colunas + chaves estrangeiras), lida direto do
banco de produção — **nenhuma leitura de linha, nenhuma alteração**. Esta
auditoria é só leitura de estrutura; as correções, quando decididas, viram
demandas próprias, uma por vez (regra 3 do `CLAUDE.md`).

A regra para dado **novo** já está na Constituição do `CLAUDE.md` desde a Fase 0.
Isto aqui é o passivo: as 60 tabelas que já existiam antes da regra, olhadas uma
por uma.

## Como ler

O que importa aqui não é "de quem é esta linha" — é **"a qual CONTA (mentor
pagante) esta linha pertence"**, porque é essa pergunta que decide, no dia do
segundo cliente, se os dados de um vazam para o outro. Por isso `people.user_id`
(o login do próprio avaliado) não conta como dono nesta auditoria, mas
`people.mentor_id` (de qual mentor é esse cadastro) conta.

| Símbolo | Significa |
|---|---|
| ✅ | **Tem dono direto** — a própria tabela guarda `mentor_id`/`owner_id`/`conta_id` |
| 🔗 | **Herda o dono** — chega à conta por um relacionamento claro (um salto ou uma cadeia de saltos, mas sempre um caminho só) |
| 🔗⚠️ | **Herda, mas frágil** — existem DOIS caminhos possíveis e nada no banco diz qual usar |
| 📚 | **Catálogo global, sem dono por desenho** — não é passivo, é intencional |
| ❌ | **Sem dono e sem caminho confiável** |

## Resultado em números

**60 tabelas · 29 ✅ · 30 🔗 (8 de salto único + 18 em cadeia + 4 frágeis) · 1 📚 · 0 ❌.**

Nenhuma tabela ficou sem caminho nenhum até uma conta. Mas duas coisas pedem
atenção antes de um segundo mentor pagante entrar — o cluster de Comunidade
(🔗⚠️) e as colunas de dono sem chave estrangeira aplicada — detalhadas nas
seções de risco e na ordem de correção, mais abaixo.

---

## ✅ Tem dono direto (29)

| Tabela | Coluna de dono | Observação |
|---|---|---|
| `academy_banners` | `mentor_id` | ⚠️ sem FK aplicada |
| `assessment_responses` | `mentor_id` | ⚠️ sem FK aplicada |
| `biblioteca_materiais` | `mentor_id` | ⚠️ sem FK aplicada |
| `biblioteca_pastas` | `mentor_id` | ⚠️ sem FK aplicada |
| `dominios_conta` | `owner_id` | |
| `email_logs` | `mentor_id` | |
| `eventos` | `conta_id` | ⚠️ sem FK aplicada |
| `export_logs` | `owner_id` | ⚠️ sem FK aplicada |
| `google_agendas_criadas` | `mentor_id` | é a própria chave primária |
| `google_conexoes` | `user_id` | é a própria conexão do dono |
| `google_eventos` | `user_id` | |
| `groups` | `mentor_id` | |
| `invite_links` | `mentor_id` | ⚠️ sem FK aplicada |
| `learning_tracks` | `owner_id` | |
| `mentoria_arquivos` | `mentor_id` | |
| `mentoria_disponibilidade` | `mentor_id` | |
| `mentoria_links` | `mentor_id` | |
| `mentoria_sessoes` | `mentor_id` | |
| `mentoria_tarefas` | `mentor_id` | |
| `mentorias` | `mentor_id` | |
| `mentors` | `owner_id` | |
| `notificacoes` | `conta_id` | ⚠️ sem FK aplicada; `user_id` é o destinatário, não a conta |
| `people` | `mentor_id` | |
| `pontos` | `mentor_id` | |
| `profiles` | `user_id` | é a própria chave primária — a linha É a conta |
| `team_members` | `owner_id` | |
| `test_responses` | `mentor_id` | |
| `test_versions` | `mentor_id` | nulo de propósito quando `is_template=true` — ver 📚 |
| `treinamentos` | `mentor_id` | ⚠️ sem FK aplicada |

**Nove** dessas colunas existem mas **não têm chave estrangeira aplicada** no
banco (marcadas ⚠️): `academy_banners`, `assessment_responses`,
`biblioteca_materiais`, `biblioteca_pastas`, `eventos`, `export_logs`,
`invite_links`, `notificacoes`, `treinamentos`. Isto não é "sem dono" — a
coluna existe e uma política de RLS funciona normalmente sem a chave
estrangeira. O risco é mais silencioso: nada no banco impede um valor inválido
ou de outra conta ali dentro por engano (um `INSERT` com o `mentor_id` errado
é aceito sem reclamar).

---

## 🔗 Herda o dono — caminho de salto único (8)

| Tabela | Caminho até o dono |
|---|---|
| `action_plans` | `response_id` → `test_responses.mentor_id` |
| `evento_destinos` | `evento_id` → `eventos.conta_id` |
| `group_instruments` | `group_id` → `groups.mentor_id` |
| `group_members` | `group_id` → `groups.mentor_id` |
| `lembretes_enviados` | `sessao_id` → `mentoria_sessoes.mentor_id` |
| `team_member_groups` | `team_member_id` → `team_members.owner_id` |
| `test_answers` | `response_id` → `test_responses.mentor_id` |
| `treinamento_grupos` | `treinamento_id` → `treinamentos.mentor_id` |

## 🔗 Herda o dono — cadeia de vários saltos (18)

Ainda é um caminho só e confiável — só passa por mais de uma tabela até
chegar lá.

| Tabela | Caminho até o dono |
|---|---|
| `biblioteca_material_destinos` | `material_id` → `biblioteca_materiais.mentor_id` |
| `biblioteca_pasta_destinos` | `pasta_id` → `biblioteca_pastas.mentor_id` |
| `learning_lessons` | `track_id` → `learning_tracks.owner_id` |
| `learning_materials` | `track_id` → `learning_tracks.owner_id` |
| `learning_modules` | `track_id` → `learning_tracks.owner_id` |
| `learning_progress` | `track_id` → `learning_tracks.owner_id` (`user_id` na própria tabela é de quem progrediu, não da conta) |
| `learning_track_destinos` | `track_id` → `learning_tracks.owner_id` |
| `option_scores` | `option_id` → `test_options` → `test_questions` → `test_versions.mentor_id` (3 saltos — a cadeia mais longa do banco) |
| `report_content` | `version_id` → `test_versions.mentor_id` (nulo quando é conteúdo global — ver 📚) |
| `test_dimensions` | `version_id` → `test_versions.mentor_id` (nulo quando é template) |
| `test_options` | `question_id` → `test_questions` → `test_versions.mentor_id` (2 saltos) |
| `test_questions` | `version_id` → `test_versions.mentor_id` (nulo quando é template) |
| `test_result_bands` | `version_id` → `test_versions.mentor_id` (nulo quando é template) |
| `treinamento_anotacoes` | `aula_id` → `treinamento_aulas` → `treinamento_modulos` → `treinamentos.mentor_id` (3 saltos) |
| `treinamento_aulas` | `modulo_id` → `treinamento_modulos` → `treinamentos.mentor_id` (2 saltos) |
| `treinamento_materiais` | `aula_id` → `treinamento_aulas` → `treinamento_modulos` → `treinamentos.mentor_id` (3 saltos) |
| `treinamento_modulos` | `treinamento_id` → `treinamentos.mentor_id` |
| `treinamento_presencas` | `person_id` → `people.mentor_id` (caminho mais curto; também chega via `aula_id`, mais longo) |

A cadeia de `option_scores` (e as de teste/treinamento em geral) já funciona
hoje através de funções `SECURITY DEFINER` do próprio banco
(`owns_test_version`, `question_version_id`, `option_version_id`) — o
`CLAUDE.md` já registra que elas dependem de `GRANT EXECUTE` e que o scanner
de segurança do Lovable já revogou isso uma vez, derrubando o app inteiro. Não
é um problema de dono do dado — é um lembrete de que essa cadeia é a mais
frágil operacionalmente, não a mais arriscada para vazamento entre contas.

---

## 🔗⚠️ Herda, mas o caminho é frágil (4) — MERECE ATENÇÃO

Diferente das tabelas acima, aqui **não existe um caminho — existem dois, que
se excluem**, e nada no banco diz qual usar. Quem postou (`author_id`) pode
ser o dono da conta, um colaborador ou um mentor convidado — nesse caso o
caminho é `team_members.user_id` → `team_members.owner_id` — **ou** pode ser
um aluno — nesse caso o caminho é `people.user_id` → `people.mentor_id`.
Resolver isso hoje exige código de aplicação (é o que `membershipDoUsuario()`
já faz para outras telas); não existe um `JOIN` de banco único que sirva para
os dois casos.

| Tabela | Por que é frágil |
|---|---|
| `community_posts` | `author_id` aponta para `auth.users`, não para a conta — precisa de uma checagem tipo `membershipDoUsuario` para resolver |
| `community_comments` | herda a mesma fragilidade de `community_posts`, mais um salto (`post_id`) |
| `community_reactions` | idem — herda a fragilidade de `community_posts` |
| `community_post_groups` | quando o post tem grupo vinculado, `group_id` → `groups.mentor_id` é confiável — mas um post sem grupo vinculado (dirigido "a todos") não tem essa saída |

**Recomendação:** acrescentar uma coluna `owner_id`/`conta_id` direta em
`community_posts`, preenchida no momento da criação do post — as outras três
tabelas herdariam dela normalmente. É o mesmo padrão que `eventos` e
`notificacoes` já usam (`conta_id`), então não é um padrão novo no projeto.

**Risco de fazer:** baixo — coluna nova, opcional, aditiva; não muda nada do
que já funciona (regra 5 do `CLAUDE.md`, aplicável quando isso virar demanda).

**Risco de NÃO fazer:** este é o achado que mais importa nesta auditoria. Se
um dia uma política de RLS por conta for escrita nestas 4 tabelas assumindo
que `author_id` já basta, um post, comentário ou reação de uma conta pode
aparecer para outra — é o único ponto, entre as 60 tabelas, onde dois mentores
usando a mesma tela ao mesmo tempo têm caminho para ver o dado um do outro.

---

## 📚 Catálogo global, sem dono por desenho (1)

| Tabela | Por quê |
|---|---|
| `instruments` | é o catálogo dos testes (`disc`, `bigfive`, `valores`…) — compartilhado por toda a plataforma, nunca pertenceu a um mentor. `test_versions.instrument_id` aponta pra cá. Nada a corrigir. |

Duas outras situações têm a mesma natureza, mas vivem dentro de tabelas que
também têm linhas com dono — por isso não entram nesta lista como tabela
inteira, só o registro:

- **`test_versions.mentor_id`** é nulo de propósito quando `is_template=true`
  — é o template global, copiado quando um mentor cria a própria versão.
- **`report_content.version_id`** pode ser nulo — segundo o `CLAUDE.md`, a
  maioria dos 502 registros de hoje são os 208 blocos globais de relatório,
  compartilhados por todos.

Se algum dia alguém "corrigir" esses nulos preenchendo um `mentor_id`
qualquer, quebra o compartilhamento — o nulo aqui É a resposta certa,
registrado para não ser confundido com um buraco.

---

## ❌ Sem dono e sem caminho confiável (0)

Nenhuma tabela caiu aqui. Todas as 60 têm pelo menos um caminho até uma
conta — direto, herdado, ou (no caso do catálogo) não precisam de um.

---

## Ordem sugerida de correção

Pensando no cenário "amanhã entra um segundo mentor pagante" — da correção
que evita vazamento de verdade até a que é só arrumação:

1. **Cluster de Comunidade** (`community_posts` e as 3 que herdam dela). É o
   único ponto onde dois mentores diferentes, usando a mesma tela ao mesmo
   tempo, correm risco real de ver o dado um do outro, se a política de
   acesso for escrita direto em cima de `author_id`. **Prioridade 1** — antes
   do segundo mentor usar o menu Comunidade.
2. **As 9 colunas de dono sem chave estrangeira aplicada** — listadas na
   seção ✅ acima. Não vaza nada hoje, mas um valor errado nesses campos não
   seria pego pelo banco. **Prioridade 2** — arrumação de segurança, não
   urgente.
3. **A cadeia de `option_scores`** (e as demais cadeias de teste/treinamento).
   Já funcionam hoje através das funções `SECURITY DEFINER`. O risco aqui não
   é vazamento entre contas — é essa dependência ser revogada de novo por
   engano, como já aconteceu uma vez. **Prioridade 3**: não é sobre dono do
   dado, é sobre proteger o mecanismo que já resolve isso.
4. **Nada a fazer** nos templates globais (`test_versions.is_template`,
   `report_content` com `version_id` nulo) e no catálogo `instruments`. Ficam
   registrados aqui só para não serem "corrigidos" por engano no futuro.

---

## O que eu vi e NÃO consertei

Esta demanda é só leitura — nenhuma tabela, coluna ou política foi tocada no
banco. Três achados ficam registrados para virarem demanda própria, um de
cada vez, quando for a hora:

- **Cluster de Comunidade sem coluna de dono direta** — o achado mais
  importante desta auditoria, descrito acima.
- **9 colunas de dono sem `FOREIGN KEY` aplicada** — listadas na seção ✅.
- **A cadeia de `option_scores`, dependente do `GRANT EXECUTE`** nas funções
  de segurança — risco operacional, não de vazamento.

Nenhum destes foi corrigido agora. Se algum virar demanda, ela decide
sozinha — sem empacotar com as outras (regra 3 do `CLAUDE.md`).
