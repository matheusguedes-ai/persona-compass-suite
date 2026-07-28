-- VAK — 24 blocos de comportamento observável, sem entregar o canal medido.
-- Gerado por scripts/aplicar_conteudo.py a partir do módulo de conteúdo.

delete from public.test_questions where version_id = 'fede7d5f-7344-4646-90bb-d4f5a35ec892';

with q01 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Você precisa montar um móvel novo.', 'forced_choice', 1, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q01.id, v.label, v.ord from q01, (values
    ('Sigo o desenho do manual.', 1),
    ('Peço para alguém ir me dizendo o passo a passo.', 2),
    ('Vou montando e descobrindo no encaixe.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (2, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (3, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q02 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Alguém te explica um caminho na rua.', 'forced_choice', 2, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q02.id, v.label, v.ord from q02, (values
    ('Preciso ver num mapa depois.', 1),
    ('Repito as instruções em voz alta para gravar.', 2),
    ('Só pego mesmo depois de fazer o trajeto uma vez.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (2, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (3, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q03 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Numa palestra longa, o que te mantém acordado:', 'forced_choice', 3, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q03.id, v.label, v.ord from q03, (values
    ('A voz e o jeito de falar de quem apresenta.', 1),
    ('Ter alguma coisa para fazer com as mãos.', 2),
    ('Um slide bem feito.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (2, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (3, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q04 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Uma semana depois de conhecer uma pessoa, você lembra:', 'forced_choice', 4, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "memoria"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q04.id, v.label, v.ord from q04, (values
    ('Do rosto, mas não do nome.', 1),
    ('Do aperto de mão e da sensação que ela passou.', 2),
    ('Do nome e do jeito de falar.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (2, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (3, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q05 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Estudando para uma prova:', 'forced_choice', 5, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "aprender"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q05.id, v.label, v.ord from q05, (values
    ('Ando pela sala enquanto repasso.', 1),
    ('Leio em voz alta ou explico para alguém.', 2),
    ('Faço resumo com cor, grifo, esquema.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (2, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (3, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q06 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'O que mais te incomoda num ambiente:', 'forced_choice', 6, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "ambiente"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q06.id, v.label, v.ord from q06, (values
    ('Bagunça visual, coisa fora do lugar.', 1),
    ('Barulho de fundo.', 2),
    ('Cadeira ruim, temperatura errada.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (2, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (3, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q07 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Comprando uma roupa:', 'forced_choice', 7, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q07.id, v.label, v.ord from q07, (values
    ('Pergunto a opinião de quem está comigo.', 1),
    ('Preciso vestir e sentir no corpo.', 2),
    ('Vejo se combina e como cai.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (2, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (3, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q08 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Você está explicando uma ideia difícil para alguém.', 'forced_choice', 8, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "explicar"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q08.id, v.label, v.ord from q08, (values
    ('Dou um exemplo prático para ela fazer junto.', 1),
    ('Desenho num papel.', 2),
    ('Falo até a pessoa entender.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (2, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (3, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q09 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Uma música de que você gosta muito. O que vem primeiro:', 'forced_choice', 9, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q09.id, v.label, v.ord from q09, (values
    ('A letra e a melodia.', 1),
    ('A vontade de mexer o corpo.', 2),
    ('O clipe, a capa, a cena.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (2, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (3, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q10 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Quando você está pensando em algo importante:', 'forced_choice', 10, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q10.id, v.label, v.ord from q10, (values
    ('Preciso me mexer, andar.', 1),
    ('Imagino a cena.', 2),
    ('Converso comigo mesmo por dentro.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (2, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (3, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q11 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Numa reunião on-line:', 'forced_choice', 11, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q11.id, v.label, v.ord from q11, (values
    ('Faço outra coisa com as mãos para me concentrar.', 1),
    ('Preciso ver a tela compartilhada.', 2),
    ('Acompanho bem só ouvindo.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (2, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (3, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q12 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'O que te faz lembrar de uma viagem antiga:', 'forced_choice', 12, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "memoria"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q12.id, v.label, v.ord from q12, (values
    ('Um cheiro ou uma temperatura.', 1),
    ('Uma música daquela época.', 2),
    ('As fotos.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (2, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (3, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q13 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Aprendendo um programa novo no computador:', 'forced_choice', 13, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "aprender"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q13.id, v.label, v.ord from q13, (values
    ('Ouço alguém me explicando.', 1),
    ('Assisto a um vídeo mostrando a tela.', 2),
    ('Vou clicando até descobrir.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (2, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (3, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q14 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Você se distrai mais fácil com:', 'forced_choice', 14, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q14.id, v.label, v.ord from q14, (values
    ('Desconforto físico.', 1),
    ('Movimento no canto do olho.', 2),
    ('Uma conversa ao fundo.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (2, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (3, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q15 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Preparando uma apresentação sua, o que você mais cuida:', 'forced_choice', 15, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q15.id, v.label, v.ord from q15, (values
    ('Do visual dos slides.', 1),
    ('De como vou circular e usar o espaço.', 2),
    ('Do que vou falar.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (2, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (3, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q16 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Anotando o que ficou combinado numa reunião:', 'forced_choice', 16, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q16.id, v.label, v.ord from q16, (values
    ('Escrevo em tópicos, com setas e destaques.', 1),
    ('Escrevo à mão, mesmo sem reler depois.', 2),
    ('Gravo, ou confio no que ouvi.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (2, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (3, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q17 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Quando você não consegue dormir:', 'forced_choice', 17, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q17.id, v.label, v.ord from q17, (values
    ('Fico com imagens passando na cabeça.', 1),
    ('Fico me mexendo, sem achar posição.', 2),
    ('Fico com uma conversa se repetindo.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (2, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (3, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q18 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'O que mais pesa na sua primeira impressão de um lugar:', 'forced_choice', 18, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "ambiente"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q18.id, v.label, v.ord from q18, (values
    ('O som do ambiente.', 1),
    ('O conforto e o clima.', 2),
    ('A aparência.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (2, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (3, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q19 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Uma notícia importante. Você prefere:', 'forced_choice', 19, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q19.id, v.label, v.ord from q19, (values
    ('Estar presente na hora.', 1),
    ('Ouvir de alguém.', 2),
    ('Ler por escrito.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (2, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (3, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q20 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Decorando um número de telefone:', 'forced_choice', 20, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q20.id, v.label, v.ord from q20, (values
    ('Digito até a mão decorar.', 1),
    ('Repito em voz alta.', 2),
    ('Vejo os números na cabeça.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1),
    (2, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (3, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q21 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Alguém está te explicando e você não entendeu.', 'forced_choice', 21, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "explicar"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q21.id, v.label, v.ord from q21, (values
    ('Peço para mostrar.', 1),
    ('Peço para explicar de novo, com outras palavras.', 2),
    ('Peço para me deixar tentar.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (2, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (3, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q22 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'O que te ajuda a relaxar:', 'forced_choice', 22, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q22.id, v.label, v.ord from q22, (values
    ('Música, ou silêncio.', 1),
    ('Um lugar bonito para olhar.', 2),
    ('Movimento, banho, comida.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (2, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (3, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q23 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Numa conversa importante, o que te diz mais sobre a pessoa:', 'forced_choice', 23, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q23.id, v.label, v.ord from q23, (values
    ('O tom de voz.', 1),
    ('A expressão do rosto.', 2),
    ('A postura e a energia do corpo.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (2, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (3, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q24 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fede7d5f-7344-4646-90bb-d4f5a35ec892', 'Quando você conta uma história:', 'forced_choice', 24, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q24.id, v.label, v.ord from q24, (values
    ('Imito as vozes.', 1),
    ('Descrevo como era.', 2),
    ('Uso as mãos e o corpo.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '44fec620-9c6a-4d45-9566-9e9128b4400f'::uuid, 1),
    (2, 'ddc3cc9a-0be3-47e0-b67a-c0630eb8b365'::uuid, 1),
    (3, 'b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;
