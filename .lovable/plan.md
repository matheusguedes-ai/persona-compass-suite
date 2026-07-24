## Objetivo desta fase

Construir apenas a **interface** (frontend, sem backend/testes reais) da plataforma de gestão de testes psicométricos e comportamentais, inspirada na CIS Assessment da Febracis, em português (Brasil), no estilo "Analytical Workspace" (Geist, cinzas zinc, acento ciano/teal escuro).

Nenhum teste real, nenhum envio de email real, nenhum banco de dados ainda. Dados mock em memória para dar vida à navegação.

## Escopo de telas

Todas com sidebar fixa à esquerda + header sticky + área principal em grid.

1. **`/` — Dashboard**
   - 4 KPIs: Testes enviados, Respondidos, Pendentes, Tempo médio de conclusão
   - Gráfico de barras (atividade dos últimos 20 dias) + painel "Disparo Rápido" (mock)
   - Catálogo em destaque (3 cards)
   - Tabela "Últimos Envios" (avaliado, instrumento, status, data, ação)

2. **`/pessoas` — Gestão de Pessoas**
   - Lista/tabela de avaliados com busca e filtro por papel (Cliente / Aluno / Colaborador)
   - Botão "Adicionar pessoa" abre modal (nome, email, papel, tags)
   - Coluna de ações: Ver perfil, Enviar teste

3. **`/pessoas/$id` — Perfil do avaliado**
   - Cabeçalho com avatar, dados, papel
   - Abas: Visão geral, Testes recebidos, Histórico
   - Placeholder para relatórios (fase futura)

4. **`/testes` — Catálogo de Testes**
   - Grid de cards por instrumento: DISC, Big Five, MBTI, Temperamentos, Canais de Acesso (VAK), QI
   - Cada card: categoria (Comportamental / Psicométrico / Cognitivo), duração estimada, descrição, botão "Enviar"
   - Filtro por categoria

5. **`/envios` — Envios**
   - Tabela completa com filtros (status, instrumento, data)
   - Status: Pendente, Em andamento, Concluído, Expirado
   - Ações: Copiar link, Reenviar email, Cancelar

6. **`/envios/novo` — Novo envio (drawer/dialog)**
   - Wizard em passos: 1) escolher avaliado(s), 2) escolher testes, 3) canal (Email + Link / Só link), 4) prazo, 5) revisão
   - Gera link mockado ao final

7. **`/relatorios` — Relatórios** (placeholder da fase futura)
   - Estado vazio explicativo: "Os relatórios aparecerão aqui quando os testes forem construídos"

8. **`/configuracoes` — Configurações**
   - Abas: Perfil da conta, Equipe (coaches), Marca (logo, cor), Modelos de email

9. **`/auth` — Login / Cadastro** (visual apenas)
   - Duas colunas: formulário + painel de marca
   - Papéis: admin, coach, avaliado (seletor visual pré-preenchido para prototipagem)

10. **Perfil "Avaliado" (`/meus-testes`)** — visão simplificada
    - Lista de testes recebidos com botão "Iniciar" (não funcional ainda)

## Design system

Tokens em `src/styles.css` (sobrescrever oklch atuais):
- Fonte: **Geist** (via `<link>` no `__root.tsx`)
- Fundo: zinc-50; Superfícies: white/zinc-100; Bordas: black/5%
- `--primary`: `#164e63` (brand-primary, teal escuro)
- `--accent`: `#0d9488` (brand-accent) + `#0891b2` (cyan-600) para destaques
- Status: emerald (concluído), amber (em andamento/pendente urgente), zinc (pendente), rose (expirado)
- Radius padrão `0.5rem`; cards `rounded-xl` com `ring-1 ring-black/5`
- Tipografia: `tracking-tight` em títulos, uppercase `tracking-wider` em rótulos KPI

## Arquitetura técnica

- **TanStack Router** com rotas em `src/routes/` (dot-separated)
- Layout autenticado em `src/routes/_app.tsx` (pathless) que renderiza sidebar + header + `<Outlet />`. Filhos: `_app.index.tsx` (dashboard em `/`), `_app.pessoas.tsx`, `_app.pessoas.$id.tsx`, `_app.testes.tsx`, `_app.envios.tsx`, `_app.envios.novo.tsx`, `_app.relatorios.tsx`, `_app.configuracoes.tsx`, `_app.meus-testes.tsx`
- `src/routes/index.tsx` atual será substituído (o dashboard passa a ser o `/`)
- `src/routes/auth.tsx` fora do layout
- **Sem `_authenticated/`** — nesta fase não há login real; um "role switcher" no header (Admin / Coach / Avaliado) troca papel via Context React
- `head()` próprio em cada rota (title + description PT-BR únicos)
- Componentes shadcn: `sidebar`, `button`, `input`, `table`, `dialog`, `tabs`, `badge`, `card`, `select`, `avatar`, `dropdown-menu`, `sonner`
- Dados mock em `src/lib/mock-data.ts` (pessoas, testes, envios)
- Contexto de papel em `src/lib/role-context.tsx`

## Componentes reutilizáveis

- `AppSidebar` (com navegação por papel: avaliado vê só "Meus Testes" e "Perfil")
- `AppHeader` (busca global mock + botão "Novo Envio" + role switcher + avatar)
- `KpiCard`, `StatusBadge`, `TestInstrumentCard`, `PersonRow`, `EmptyState`

## Fora do escopo desta fase

- Perguntas/lógica dos testes (DISC, Big Five, etc.)
- Cálculo e geração de relatórios
- Envio real de email
- Autenticação real e banco de dados (Lovable Cloud)
- Multi-tenant / cobrança

Essas serão as próximas fases depois que você validar a casca.

## Entregável

Fluxo navegável ponta-a-ponta: fazer login (mock) → dashboard → adicionar pessoa → abrir catálogo → disparar teste (wizard) → ver envio na lista → alternar para o perfil "Avaliado" e ver testes recebidos.