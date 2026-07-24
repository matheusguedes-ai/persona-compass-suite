## Reestruturação do menu lateral

Vou reorganizar o menu lateral (admin/coach) para refletir a nova estrutura solicitada, adicionando as áreas de **Estatísticas**, **Grupos** e **Mentores**, e removendo **Catálogo de Testes**, **Envios** e **Relatórios** da navegação principal.

### Nova navegação (admin/coach)

| Item | Rota | Ícone | Descrição |
|---|---|---|---|
| Dashboard | `/` | LayoutDashboard | Homepage (mantém o dashboard atual) |
| Estatísticas | `/estatisticas` | BarChart3 | Gráficos quantitativos/qualitativos das respostas |
| Grupos | `/grupos` | Users2 (ou FolderKanban) | Campanhas segmentadas (turmas, empresas, setores) |
| Pessoas | `/pessoas` | Users | Avaliados que responderam (já existe) |
| Mentores | `/mentores` | GraduationCap | CRUD de coaches/mentores |
| Configurações | `/configuracoes` | Settings | Preferências + White Label |

Navegação do perfil **Avaliado** permanece como está (Meus Testes + Perfil).

### Rotas a criar (esqueleto de UI mockada)

Todas seguem o mesmo padrão visual "Analytical Workspace" já usado nas outras páginas: cabeçalho da página + card com estado vazio explicativo, para manter a navegação inteira funcional.

1. `src/routes/_app.estatisticas.tsx` — página com placeholders de 4 KPIs + área "Gráficos em breve" (EmptyState). Sem dados ainda.
2. `src/routes/_app.grupos.tsx` — cabeçalho "Grupos" com botão "Novo grupo" (não funcional) + tabela mock de 2–3 grupos exemplo (nome, tipo — Turma/Empresa/Setor, nº de pessoas, ações) para dar sensação de vida.
3. `src/routes/_app.mentores.tsx` — cabeçalho "Mentores" com botão "Adicionar mentor" + tabela mock de 2–3 mentores (nome, email, especialidade, ações).
4. `src/routes/configuracoes.tsx` já **não existe** hoje — vou criar `src/routes/_app.configuracoes.tsx` com abas: **Perfil da conta**, **Marca (White Label)** (logo, cor primária, nome da plataforma — todos placeholders), **Equipe**, **Modelos de email**.

### Rotas mantidas mas fora do menu

`/testes`, `/envios`, `/envios/novo` continuam existindo e acessíveis por links contextuais (por exemplo o botão "Novo envio" no header e os cards do dashboard). Não vou deletar essas rotas — o fluxo de disparo de testes segue funcional, só deixa de ocupar espaço na navegação principal.

### Arquivos a editar

- `src/components/app-sidebar.tsx` — reescrever `ADMIN_NAV` com os 6 itens acima e os ícones novos do lucide-react.
- `src/lib/mock-data.ts` — adicionar arrays `GROUPS` e `MENTORS` (2–3 registros cada) para popular as novas telas.

### Arquivos a criar

- `src/routes/_app.estatisticas.tsx`
- `src/routes/_app.grupos.tsx`
- `src/routes/_app.mentores.tsx`
- `src/routes/_app.configuracoes.tsx`

Cada nova rota terá seu próprio `head()` com title e description PT-BR únicos.

### Fora do escopo desta iteração

- Lógica real de criação/edição de grupos e mentores (só UI + mocks).
- Gráficos reais em Estatísticas (placeholder por enquanto).
- Aplicação real do White Label (só formulário visual).
