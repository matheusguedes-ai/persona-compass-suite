
# Conectar Pessoas, Grupos e Testes

Vamos sair dos mocks e persistir tudo no Lovable Cloud, para que as três funcionalidades se conectem de verdade. Assim, quando o próximo passo (frontend do aluno) começar, já existirá dado real por trás.

## 1. Modelo de dados (Lovable Cloud)

Novas tabelas no banco, todas com RLS habilitada e escopo por mentor logado (`auth.uid()`):

- `profiles` — perfil do usuário logado (id, nome, papel `admin | coach | avaliado`).
- `people` — avaliados cadastrados pelo mentor.
  - Campos: `full_name`, `email`, `phone`, `profession`, `role_at_company`, `notes`, `mentor_id` (dono), timestamps.
- `groups` — grupos/campanhas criados pelo mentor.
  - Campos: `name`, `type` (turma/empresa/setor), `description`, `mentor_id`, timestamps.
- `group_members` — relação N:N entre `groups` e `people` (`group_id`, `person_id`, `added_at`). Chave única no par.
- `instruments` — catálogo fixo dos testes (DISC, Big Five, MBTI, Temperamentos, VAK, QI). Leitura pública (anon SELECT). Sem escrita pelo cliente — semeado por migração.
- `group_instruments` — quais testes o grupo tem acesso (`group_id`, `instrument_id`). Chave única no par. Adicionar/remover a qualquer momento.

Regras de acesso: cada mentor só enxerga e altera as próprias `people`, `groups`, `group_members` e `group_instruments`. `instruments` é leitura pública.

## 2. Fluxos conectados

### Adicionar pessoa (Pessoas)
Modal atualizado com os campos: nome completo, e-mail, telefone (celular), profissão, cargo, observações. Ao salvar, insere em `people` com `mentor_id = auth.uid()`. Lista e busca passam a consultar o banco.

### Perfil da pessoa
Mostra os novos campos e uma seção "Grupos" listando os grupos aos quais ela pertence, com ação para adicionar/remover de grupos existentes.

### Criar / editar grupo (Grupos)
Wizard em modal com 3 passos:
1. **Dados do grupo** — nome, tipo, descrição.
2. **Pessoas** — multi-seleção com busca sobre `people` do mentor, criando registros em `group_members`.
3. **Testes liberados** — checklist dos `instruments`, gravando em `group_instruments`.

### Detalhe do grupo (nova rota `/grupos/$id`)
- Cabeçalho com nome/tipo/descrição.
- Aba **Pessoas**: lista membros, adicionar/remover pessoas (edita `group_members`).
- Aba **Testes**: checklist com os testes liberados, adicionar/remover em tempo real (edita `group_instruments`).
- Botão "Enviar teste" fica restrito aos testes liberados do grupo.

### Envio de teste
O wizard de envio já existente passa a validar: só permite escolher instrumentos que estejam em `group_instruments` quando o destinatário for via grupo, ou qualquer teste quando for envio avulso a uma pessoa.

## 3. Camada de servidor

Server functions TanStack em `src/lib/`:
- `people.functions.ts`: `listPeople`, `createPerson`, `updatePerson`, `deletePerson`, `getPerson`.
- `groups.functions.ts`: `listGroups`, `createGroup`, `getGroup`, `updateGroup`, `deleteGroup`.
- `groupMembers.functions.ts`: `listGroupMembers`, `addPeopleToGroup`, `removePersonFromGroup`, `listGroupsForPerson`.
- `groupInstruments.functions.ts`: `listGroupInstruments`, `setGroupInstruments` (substitui o conjunto), `toggleGroupInstrument`.
- `instruments.functions.ts`: `listInstruments` (público).

Todas com `requireSupabaseAuth`, exceto `listInstruments`. Componentes consomem via TanStack Query (padrão do template).

## 4. Ajustes de UI necessários

- `src/routes/_app.pessoas.tsx`: formulário expandido, listagem vinda do banco, filtros mantidos.
- `src/routes/_app.pessoas.$id.tsx`: novos campos + seção "Grupos".
- `src/routes/_app.grupos.tsx`: substituir mocks, abrir novo wizard.
- `src/routes/_app.grupos.$id.tsx` (novo): detalhe do grupo com abas Pessoas/Testes.
- `src/routes/_app.envios.novo.tsx`: filtrar instrumentos por grupo.
- `src/lib/mock-data.ts`: manter só o que sobrar de mock (labels/enums); remover `PEOPLE`/`GROUPS` do uso runtime.

## 5. Ordem de execução

1. Migração SQL com todas as tabelas, RLS, grants e seed de `instruments`.
2. Server functions e hooks de query/mutation.
3. Refatorar telas Pessoas / Perfil / Grupos + nova rota de detalhe do grupo.
4. Ajustar wizard de envio para respeitar `group_instruments`.
5. Smoke test: criar pessoa → criar grupo com essa pessoa e 2 testes → abrir detalhe do grupo → alterar testes liberados → tentar enviar.

Depois disso a base fica sólida para começarmos o **frontend do aluno (avaliado)** no próximo ciclo.
