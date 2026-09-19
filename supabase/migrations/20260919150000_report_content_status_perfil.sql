-- #288 Etapa 2c — texto do perfil cadastrável, com estado.
--
-- A página de intensidade do relatório mostra um texto por sigla de perfil (S, CS, CI…), que vive em
-- report_content como os demais textos do relatório (seções `disc_perfil_texto`,
-- `temperamentos_perfil_texto`, `vak_perfil_texto`). Parte das siglas ainda não tem texto aprovado:
-- elas ficam registradas como PENDENTES, e o relatório mostra um aviso no lugar do texto em vez de
-- inventar uma descrição de personalidade.
--
-- Só ADICIONA (regra 5 da constituição): coluna nova com valor padrão. O código publicado lê
-- report_content com lista explícita de colunas e não enxerga `status`; as linhas que já existem
-- nascem 'publicado' e continuam aparecendo exatamente como antes.
--
-- Dono: segue o padrão da tabela. version_id NULL = texto da plataforma (só a chave de serviço
-- escreve, pela policy rc_write); version_id preenchido = texto de uma versão, escrito pelo dono dela.

alter table public.report_content
  add column if not exists status text not null default 'publicado';

alter table public.report_content
  drop constraint if exists report_content_status_check;

alter table public.report_content
  add constraint report_content_status_check check (status in ('publicado', 'pendente'));

comment on column public.report_content.status is
  'publicado = aparece no relatório; pendente = registrado, ainda sem texto aprovado (o relatório mostra um aviso no lugar).';
