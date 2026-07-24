## Objetivo

Incluir na barra lateral um item "Testes" que, ao ser clicado, apenas expande/recolhe e revela uma lista com todos os testes já existentes no catálogo (DISC, Big Five, MBTI, Temperamentos, VAK, QI). Não haverá navegação — é puramente visual, servindo de referência rápida dos instrumentos disponíveis.

## Alterações

**`src/components/app-sidebar.tsx`**
- Adicionar ícone `FlaskConical` (ou similar) para o item pai "Testes".
- Introduzir estado local `testesOpen` (`useState(false)`) para controlar expansão.
- Renderizar, entre "Grupos" e "Pessoas" do menu ADMIN, um botão (não `<Link>`) "Testes" com chevron que gira conforme o estado.
- Abaixo, quando expandido, renderizar a lista de `INSTRUMENTS` (importada de `@/lib/mock-data`) como itens visuais indentados — apenas `<div>`/`<span>` não clicáveis, com o `shortName` e um pequeno bullet colorido usando o `accent` do instrumento.
- Não alterar o menu do perfil AVALIADO.

## Fora do escopo

- Nenhuma rota nova.
- Nenhuma alteração em dados, backend ou nas páginas de catálogo/envios existentes.
- Nenhuma mudança de comportamento no menu do avaliado.
