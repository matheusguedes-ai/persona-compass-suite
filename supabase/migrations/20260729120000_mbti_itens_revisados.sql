-- Tipos Psicológicos — 40 perguntas, 10 por eixo, lado alternado.
-- Gerado por scripts/aplicar_conteudo.py a partir do módulo de conteúdo.

delete from public.test_questions where version_id = 'fda8d1f0-3613-40cf-ac70-cdfb204f03d4';

with q01 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Depois de uma semana cheia, o que te recarrega:', 'multiple_choice', 1, true, '{"check_group": "energia"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q01.id, v.label, v.ord from q01, (values
    ('Sair, ver gente.', 1),
    ('Ficar em casa, no meu ritmo.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'c014d6aa-295b-4ef1-98e9-6e6ec4130be8'::uuid, 1),
    (2, 'ade90606-693e-4546-9807-ff8d9a4fce57'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q02 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Ao aprender algo novo, você começa por:', 'multiple_choice', 2, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q02.id, v.label, v.ord from q02, (values
    ('Exemplos práticos e um passo a passo.', 1),
    ('A ideia geral e o porquê por trás.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e4bec9ac-6016-4d9c-b0c1-47f0f586cf70'::uuid, 1),
    (2, '7374fdae-3947-42ad-8297-4b5988f901fc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q03 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Um amigo te conta um problema.', 'multiple_choice', 3, true, '{"check_group": "acolher"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q03.id, v.label, v.ord from q03, (values
    ('Ajudo a achar a solução.', 1),
    ('Primeiro escuto e acolho.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9e6c8582-0d1f-4116-ac28-303f2fdc490b'::uuid, 1),
    (2, '47db318d-38f6-4f9c-9f0d-cba52950898d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q04 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Uma viagem:', 'multiple_choice', 4, true, '{"check_group": "planejar"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q04.id, v.label, v.ord from q04, (values
    ('Planejo antes.', 1),
    ('Decido no caminho.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '1707edf5-72c8-413e-abb3-cb7cceb91163'::uuid, 1),
    (2, '1b1096f8-61bf-4dff-a7a4-43c2ee88c004'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q05 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Numa festa onde você quase não conhece ninguém:', 'multiple_choice', 5, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q05.id, v.label, v.ord from q05, (values
    ('Circulo e vou puxando conversa.', 1),
    ('Fico perto de quem eu já conheço.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'c014d6aa-295b-4ef1-98e9-6e6ec4130be8'::uuid, 1),
    (2, 'ade90606-693e-4546-9807-ff8d9a4fce57'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q06 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Você confia mais:', 'multiple_choice', 6, true, '{"check_group": "confianca"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q06.id, v.label, v.ord from q06, (values
    ('No que já foi testado.', 1),
    ('No meu pressentimento.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e4bec9ac-6016-4d9c-b0c1-47f0f586cf70'::uuid, 1),
    (2, '7374fdae-3947-42ad-8297-4b5988f901fc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q07 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Uma decisão difícil na equipe. O que pesa mais:', 'multiple_choice', 7, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q07.id, v.label, v.ord from q07, (values
    ('O impacto nas pessoas.', 1),
    ('O que é mais justo pelo critério.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '47db318d-38f6-4f9c-9f0d-cba52950898d'::uuid, 1),
    (2, '9e6c8582-0d1f-4116-ac28-303f2fdc490b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q08 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Sua lista de tarefas:', 'multiple_choice', 8, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q08.id, v.label, v.ord from q08, (values
    ('Existe mais ou menos.', 1),
    ('Existe, e eu sigo.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '1b1096f8-61bf-4dff-a7a4-43c2ee88c004'::uuid, 1),
    (2, '1707edf5-72c8-413e-abb3-cb7cceb91163'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q09 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Você teve uma ideia boa no trabalho.', 'multiple_choice', 9, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q09.id, v.label, v.ord from q09, (values
    ('Falo dela logo, para pensar junto com alguém.', 1),
    ('Amadureço sozinho antes de apresentar.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'c014d6aa-295b-4ef1-98e9-6e6ec4130be8'::uuid, 1),
    (2, 'ade90606-693e-4546-9807-ff8d9a4fce57'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q10 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Descrevendo um lugar que visitou:', 'multiple_choice', 10, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q10.id, v.label, v.ord from q10, (values
    ('Conto os detalhes: o que tinha, como era.', 1),
    ('Conto a impressão que me deu.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e4bec9ac-6016-4d9c-b0c1-47f0f586cf70'::uuid, 1),
    (2, '7374fdae-3947-42ad-8297-4b5988f901fc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q11 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Uma crítica dura, mas correta:', 'multiple_choice', 11, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q11.id, v.label, v.ord from q11, (values
    ('O jeito de falar me marca mais que o conteúdo.', 1),
    ('Aceito: o que importa é o conteúdo.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '47db318d-38f6-4f9c-9f0d-cba52950898d'::uuid, 1),
    (2, '9e6c8582-0d1f-4116-ac28-303f2fdc490b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q12 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Um prazo que ainda está longe:', 'multiple_choice', 12, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q12.id, v.label, v.ord from q12, (values
    ('Começo cedo.', 1),
    ('Começo quando ele chega perto.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '1707edf5-72c8-413e-abb3-cb7cceb91163'::uuid, 1),
    (2, '1b1096f8-61bf-4dff-a7a4-43c2ee88c004'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q13 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Um dia inteiro trabalhando sozinho:', 'multiple_choice', 13, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q13.id, v.label, v.ord from q13, (values
    ('Rende muito, gosto.', 1),
    ('Me deixa meio murcho.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ade90606-693e-4546-9807-ff8d9a4fce57'::uuid, 1),
    (2, 'c014d6aa-295b-4ef1-98e9-6e6ec4130be8'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q14 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Pensando nos próximos cinco anos:', 'multiple_choice', 14, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q14.id, v.label, v.ord from q14, (values
    ('Gosto de imaginar as possibilidades.', 1),
    ('Quero saber os passos concretos.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '7374fdae-3947-42ad-8297-4b5988f901fc'::uuid, 1),
    (2, 'e4bec9ac-6016-4d9c-b0c1-47f0f586cf70'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q15 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Alguém não está entregando e vai precisar sair:', 'multiple_choice', 15, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q15.id, v.label, v.ord from q15, (values
    ('Difícil, mas é o que tem de ser feito.', 1),
    ('Procuro todo caminho possível antes disso.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9e6c8582-0d1f-4116-ac28-303f2fdc490b'::uuid, 1),
    (2, '47db318d-38f6-4f9c-9f0d-cba52950898d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q16 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Mudança de plano em cima da hora:', 'multiple_choice', 16, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q16.id, v.label, v.ord from q16, (values
    ('Me incomoda bastante.', 1),
    ('Tranquilo, me adapto.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '1707edf5-72c8-413e-abb3-cb7cceb91163'::uuid, 1),
    (2, '1b1096f8-61bf-4dff-a7a4-43c2ee88c004'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q17 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Ao telefone com alguém de quem você gosta:', 'multiple_choice', 17, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q17.id, v.label, v.ord from q17, (values
    ('Podia ficar horas.', 1),
    ('Resolvo e desligo.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'c014d6aa-295b-4ef1-98e9-6e6ec4130be8'::uuid, 1),
    (2, 'ade90606-693e-4546-9807-ff8d9a4fce57'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q18 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Diante de um manual de instruções:', 'multiple_choice', 18, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q18.id, v.label, v.ord from q18, (values
    ('Leio o que preciso e faço.', 1),
    ('Pulo trechos e vou pegando a lógica.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e4bec9ac-6016-4d9c-b0c1-47f0f586cf70'::uuid, 1),
    (2, '7374fdae-3947-42ad-8297-4b5988f901fc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q19 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Você se orgulha mais de ser:', 'multiple_choice', 19, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q19.id, v.label, v.ord from q19, (values
    ('Justo.', 1),
    ('Compreensivo.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9e6c8582-0d1f-4116-ac28-303f2fdc490b'::uuid, 1),
    (2, '47db318d-38f6-4f9c-9f0d-cba52950898d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q20 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Você se sente melhor:', 'multiple_choice', 20, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q20.id, v.label, v.ord from q20, (values
    ('Com as coisas decididas.', 1),
    ('Com as opções em aberto.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '1707edf5-72c8-413e-abb3-cb7cceb91163'::uuid, 1),
    (2, '1b1096f8-61bf-4dff-a7a4-43c2ee88c004'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q21 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Num grupo de mensagens agitado:', 'multiple_choice', 21, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q21.id, v.label, v.ord from q21, (values
    ('Leio tudo e quase não escrevo.', 1),
    ('Participo bastante.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ade90606-693e-4546-9807-ff8d9a4fce57'::uuid, 1),
    (2, 'c014d6aa-295b-4ef1-98e9-6e6ec4130be8'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q22 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'O que te interessa mais numa conversa:', 'multiple_choice', 22, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q22.id, v.label, v.ord from q22, (values
    ('As ideias e as ligações entre elas.', 1),
    ('Os fatos e o que de fato aconteceu.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '7374fdae-3947-42ad-8297-4b5988f901fc'::uuid, 1),
    (2, 'e4bec9ac-6016-4d9c-b0c1-47f0f586cf70'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q23 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Numa discussão, o que te faz mudar de ideia:', 'multiple_choice', 23, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q23.id, v.label, v.ord from q23, (values
    ('Ver que o argumento se sustenta.', 1),
    ('Ver que a outra pessoa se importa de verdade.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9e6c8582-0d1f-4116-ac28-303f2fdc490b'::uuid, 1),
    (2, '47db318d-38f6-4f9c-9f0d-cba52950898d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q24 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Sua mesa ou sua casa:', 'multiple_choice', 24, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q24.id, v.label, v.ord from q24, (values
    ('Tem uma ordem que só eu entendo.', 1),
    ('Tem um lugar certo para cada coisa.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '1b1096f8-61bf-4dff-a7a4-43c2ee88c004'::uuid, 1),
    (2, '1707edf5-72c8-413e-abb3-cb7cceb91163'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q25 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Você pensa melhor:', 'multiple_choice', 25, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q25.id, v.label, v.ord from q25, (values
    ('Falando com alguém.', 1),
    ('Sozinho, em silêncio.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'c014d6aa-295b-4ef1-98e9-6e6ec4130be8'::uuid, 1),
    (2, 'ade90606-693e-4546-9807-ff8d9a4fce57'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q26 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Você repara mais:', 'multiple_choice', 26, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q26.id, v.label, v.ord from q26, (values
    ('No que está diante de você.', 1),
    ('No que aquilo pode vir a ser.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e4bec9ac-6016-4d9c-b0c1-47f0f586cf70'::uuid, 1),
    (2, '7374fdae-3947-42ad-8297-4b5988f901fc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q27 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Alguém começa a chorar na sua frente.', 'multiple_choice', 27, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q27.id, v.label, v.ord from q27, (values
    ('Sinto junto.', 1),
    ('Já fico pensando em como resolver o que causou.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '47db318d-38f6-4f9c-9f0d-cba52950898d'::uuid, 1),
    (2, '9e6c8582-0d1f-4116-ac28-303f2fdc490b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q28 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Sábado de manhã:', 'multiple_choice', 28, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q28.id, v.label, v.ord from q28, (values
    ('Vejo o que der vontade.', 1),
    ('Já sei o que vou fazer.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '1b1096f8-61bf-4dff-a7a4-43c2ee88c004'::uuid, 1),
    (2, '1707edf5-72c8-413e-abb3-cb7cceb91163'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q29 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Um fim de semana bom tem:', 'multiple_choice', 29, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q29.id, v.label, v.ord from q29, (values
    ('Poucos compromissos.', 1),
    ('Gente e movimento.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ade90606-693e-4546-9807-ff8d9a4fce57'::uuid, 1),
    (2, 'c014d6aa-295b-4ef1-98e9-6e6ec4130be8'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q30 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Uma solução nova, que ninguém testou ainda:', 'multiple_choice', 30, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q30.id, v.label, v.ord from q30, (values
    ('Me atrai.', 1),
    ('Me deixa desconfiado.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '7374fdae-3947-42ad-8297-4b5988f901fc'::uuid, 1),
    (2, 'e4bec9ac-6016-4d9c-b0c1-47f0f586cf70'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q31 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Uma regra da empresa prejudica uma pessoa específica.', 'multiple_choice', 31, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q31.id, v.label, v.ord from q31, (values
    ('Regra é regra.', 1),
    ('Cada caso é um caso.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9e6c8582-0d1f-4116-ac28-303f2fdc490b'::uuid, 1),
    (2, '47db318d-38f6-4f9c-9f0d-cba52950898d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q32 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Diante de um assunto que já deu para decidir:', 'multiple_choice', 32, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q32.id, v.label, v.ord from q32, (values
    ('Prefiro deixar em aberto mais um pouco.', 1),
    ('Prefiro fechar.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '1b1096f8-61bf-4dff-a7a4-43c2ee88c004'::uuid, 1),
    (2, '1707edf5-72c8-413e-abb3-cb7cceb91163'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q33 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Numa reunião com gente nova:', 'multiple_choice', 33, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q33.id, v.label, v.ord from q33, (values
    ('Espero entender a sala antes de falar.', 1),
    ('Falo cedo.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ade90606-693e-4546-9807-ff8d9a4fce57'::uuid, 1),
    (2, 'c014d6aa-295b-4ef1-98e9-6e6ec4130be8'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q34 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Contando uma história:', 'multiple_choice', 34, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q34.id, v.label, v.ord from q34, (values
    ('Vou e volto, conforme a ideia.', 1),
    ('Sigo a ordem dos fatos.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '7374fdae-3947-42ad-8297-4b5988f901fc'::uuid, 1),
    (2, 'e4bec9ac-6016-4d9c-b0c1-47f0f586cf70'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q35 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'O elogio que mais te toca:', 'multiple_choice', 35, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q35.id, v.label, v.ord from q35, (values
    ('“Você é uma pessoa boa.”', 1),
    ('“Você é muito competente.”', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '47db318d-38f6-4f9c-9f0d-cba52950898d'::uuid, 1),
    (2, '9e6c8582-0d1f-4116-ac28-303f2fdc490b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q36 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Compras do mês:', 'multiple_choice', 36, true, '{"check_group": "planejar"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q36.id, v.label, v.ord from q36, (values
    ('Vendo na hora.', 1),
    ('Com lista.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '1b1096f8-61bf-4dff-a7a4-43c2ee88c004'::uuid, 1),
    (2, '1707edf5-72c8-413e-abb3-cb7cceb91163'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q37 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Chegando em casa depois de um dia de muita conversa:', 'multiple_choice', 37, true, '{"check_group": "energia"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q37.id, v.label, v.ord from q37, (values
    ('Preciso de um tempo em silêncio.', 1),
    ('Ainda tenho gás para mais.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ade90606-693e-4546-9807-ff8d9a4fce57'::uuid, 1),
    (2, 'c014d6aa-295b-4ef1-98e9-6e6ec4130be8'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q38 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'O que te dá mais segurança para decidir:', 'multiple_choice', 38, true, '{"check_group": "confianca"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q38.id, v.label, v.ord from q38, (values
    ('A intuição.', 1),
    ('A experiência.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '7374fdae-3947-42ad-8297-4b5988f901fc'::uuid, 1),
    (2, 'e4bec9ac-6016-4d9c-b0c1-47f0f586cf70'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q39 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Ao dar um retorno negativo para alguém:', 'multiple_choice', 39, true, '{"check_group": "acolher"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q39.id, v.label, v.ord from q39, (values
    ('Cuido do jeito antes do conteúdo.', 1),
    ('Vou direto ao ponto.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '47db318d-38f6-4f9c-9f0d-cba52950898d'::uuid, 1),
    (2, '9e6c8582-0d1f-4116-ac28-303f2fdc490b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q40 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('fda8d1f0-3613-40cf-ac70-cdfb204f03d4', 'Antes de dormir:', 'multiple_choice', 40, true, '{}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q40.id, v.label, v.ord from q40, (values
    ('Reviso o dia seguinte.', 1),
    ('Deixo para ver amanhã.', 2)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '1707edf5-72c8-413e-abb3-cb7cceb91163'::uuid, 1),
    (2, '1b1096f8-61bf-4dff-a7a4-43c2ee88c004'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;
