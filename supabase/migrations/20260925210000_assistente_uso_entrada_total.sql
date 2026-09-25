-- #289 — o medidor de ENTRADA da assistente (25/09/2026).
--
-- O que estava enganando: com o cache de prompt da Anthropic ligado (a edge function `assistente-chat`
-- marca as orientações, o relatório e o fim da conversa como cacheáveis), o campo `input_tokens` que a
-- API devolve conta SÓ o pedaço que ficou FORA do cache — o que vem depois do último ponto de cache.
-- Na prática, 2 tokens por chamada. O resto da entrada vem em outros dois campos: o que foi GRAVADO no
-- cache nesta chamada (`cache_creation_input_tokens`) e o que foi LIDO de um cache anterior
-- (`cache_read_input_tokens`). O registro sempre copiou os três fielmente; faltava a soma.
--
-- Esta migração só ACRESCENTA (regra 5): uma coluna calculada pelo próprio banco com a entrada inteira
-- que o modelo recebeu, preenchida na hora também nas linhas antigas, e o significado de cada coluna
-- gravado na tabela. Nenhum código lê ou grava a coluna nova — o registro de uso continua igual.

alter table public.assistente_uso
  add column entrada_total_tokens integer
  generated always as (input_tokens + cache_creation_input_tokens + cache_read_input_tokens) stored;

comment on column public.assistente_uso.entrada_total_tokens is
  'ENTRADA INTEIRA que o modelo recebeu nesta chamada (orientações + relatório + conversa) = input_tokens + cache_creation_input_tokens + cache_read_input_tokens. É ESTA que prova o tamanho do contexto. Calculada pelo banco.';
comment on column public.assistente_uso.input_tokens is
  'Só a parte da entrada que ficou FORA do cache (depois do último ponto de cache) — com o cache ligado, uns poucos tokens. NÃO é a entrada inteira: ver entrada_total_tokens. Cobrada a US$ 2/M.';
comment on column public.assistente_uso.cache_creation_input_tokens is
  'Parte da entrada GRAVADA no cache nesta chamada (1ª pergunta, ou cache vencido após 5 min). Cobrada a US$ 2,50/M.';
comment on column public.assistente_uso.cache_read_input_tokens is
  'Parte da entrada LIDA de um cache anterior (mesmo prefixo nos últimos 5 min). Cobrada a US$ 0,20/M.';
comment on column public.assistente_uso.output_tokens is
  'Tokens de SAÍDA (a resposta). Cobrados a US$ 10/M.';
