-- #302 — três seções novas do relatório do DISC (Matriz SWOT do Comunicador,
-- Ganhos e Perdas, Onde Isso Aparece) precisam de conteúdo ESTRUTURADO por
-- sigla (4 quadrantes × 4 itens; 2 colunas × 2 blocos + 1 frase; 6-7 cartões
-- × 3 campos) — coisa que não cabe bem num `body` de texto corrido.
--
-- Em vez de criar tabela nova, `report_content` ganha uma coluna genérica
-- `content_json`: continua a MESMA chave composta (section, dimension_key,
-- mode, version_id) e o MESMO campo `status` (publicado/pendente) que já
-- existe pra `disc_perfil_texto` — só que o corpo mora em JSON em vez de
-- markdown. `body` continua NOT NULL só por compatibilidade com as linhas de
-- texto corrido que já existem; as linhas novas gravam '' ali e usam
-- `content_json`. Aditiva: nada que já está publicado deixa de funcionar.
alter table public.report_content
  add column content_json jsonb;

comment on column public.report_content.content_json is
  '#302 — conteúdo estruturado (SWOT, Ganhos e Perdas, Onde Isso Aparece do DISC, e o que vier depois). NULL para as linhas de texto corrido de sempre.';
