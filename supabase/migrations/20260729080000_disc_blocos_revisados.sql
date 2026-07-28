-- DISC — 28 blocos situacionais, alternativas de peso social parecido, ordem embaralhada.
-- Gerado por scripts/aplicar_conteudo.py a partir do módulo de conteúdo.

delete from public.test_questions where version_id = '507bdcc1-c22e-40ae-a507-a45a38a9ebaa';

with q01 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'O prazo apertou e a decisão precisa sair hoje.', 'forced_choice', 1, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "decisao"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q01.id, v.label, v.ord from q01, (values
    ('Decido e assumo o risco de estar errado.', 1),
    ('Defendo a saída que me empolga e trago o grupo junto.', 2),
    ('Fico com a opção que causa menos ruptura para a equipe.', 3),
    ('Peço mais dados antes de fechar, mesmo que atrase.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (2, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (3, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (4, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q02 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Alguém entrega um trabalho abaixo do que foi combinado.', 'forced_choice', 2, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "cobranca"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q02.id, v.label, v.ord from q02, (values
    ('Puxo uma conversa leve e tento reanimar a pessoa.', 1),
    ('Digo na hora que não serve e peço para refazer.', 2),
    ('Aponto item por item o que ficou fora do padrão.', 3),
    ('Deixo passar dessa vez e ofereço ajuda.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (2, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (3, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (4, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q03 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Você entra numa sala onde não conhece ninguém.', 'forced_choice', 3, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q03.id, v.label, v.ord from q03, (values
    ('Puxo conversa com quem estiver mais perto.', 1),
    ('Vou direto a quem parece decidir as coisas.', 2),
    ('Espero alguém me incluir e vou me soltando aos poucos.', 3),
    ('Observo primeiro para entender como funciona ali.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (2, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (3, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (4, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q04 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'O que mais te incomoda no dia a dia de trabalho:', 'forced_choice', 4, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q04.id, v.label, v.ord from q04, (values
    ('Gente que decide no achismo.', 1),
    ('Ambiente calado, sem troca entre as pessoas.', 2),
    ('Mudança de rumo em cima da hora.', 3),
    ('Reunião longa que não chega a lugar nenhum.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (2, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (3, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (4, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q05 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Numa negociação difícil, o seu instinto é:', 'forced_choice', 5, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "conflito"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q05.id, v.label, v.ord from q05, (values
    ('Marcar posição logo no começo.', 1),
    ('Chegar com tudo levantado e deixar os dados falarem.', 2),
    ('Quebrar o gelo e criar clima antes de falar de números.', 3),
    ('Ouvir bastante antes de me posicionar.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (2, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (3, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (4, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q06 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'O plano muda no meio do caminho.', 'forced_choice', 6, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q06.id, v.label, v.ord from q06, (values
    ('Vou junto na empolgação do que vem.', 1),
    ('Quero entender o porquê antes de mudar.', 2),
    ('Custo a largar o jeito antigo.', 3),
    ('Assumo o rumo novo e toco.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (2, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (3, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (4, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q07 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'A crítica que você já ouviu sobre si:', 'forced_choice', 7, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q07.id, v.label, v.ord from q07, (values
    ('Que trava tudo no detalhe e é difícil me agradar.', 1),
    ('Que passo por cima dos outros quando quero resultado.', 2),
    ('Que falo demais e prometo o que nem sempre dá para cumprir.', 3),
    ('Que demoro a me posicionar e fujo do embate.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (2, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (3, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (4, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q08 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Como você prefere que te cobrem:', 'forced_choice', 8, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q08.id, v.label, v.ord from q08, (values
    ('Direto ao ponto, sem rodeio.', 1),
    ('Numa conversa, olho no olho.', 2),
    ('Com o critério claro do que é certo e do que não é.', 3),
    ('Com tempo e sem susto.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (2, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (3, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (4, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q09 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'O reconhecimento que mais faz sentido para você:', 'forced_choice', 9, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "imagem"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q09.id, v.label, v.ord from q09, (values
    ('Ser lembrado como quem anima o time.', 1),
    ('Ser reconhecido por quem sempre pode contar comigo.', 2),
    ('Ser reconhecido pelo resultado que entreguei.', 3),
    ('Ser reconhecido pela qualidade do que faço.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (2, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (3, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (4, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q10 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Numa reunião em que ninguém se entende:', 'forced_choice', 10, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q10.id, v.label, v.ord from q10, (values
    ('Procuro o ponto em comum entre os lados.', 1),
    ('Uso o humor e o clima para destravar.', 2),
    ('Trago o dado que encerra a discussão.', 3),
    ('Corto a discussão e proponho o encaminhamento.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (2, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (3, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (4, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q11 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Você recebe uma tarefa nova, sem instrução nenhuma.', 'forced_choice', 11, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "destravar"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q11.id, v.label, v.ord from q11, (values
    ('Procuro um modelo ou um padrão antes de começar.', 1),
    ('Pergunto a quem já fez, para não errar.', 2),
    ('Começo do meu jeito e ajusto no caminho.', 3),
    ('Chamo alguém para pensar junto.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (2, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (3, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (4, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q12 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Sobre prazos e combinados:', 'forced_choice', 12, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q12.id, v.label, v.ord from q12, (values
    ('Corto escopo para entregar no prazo.', 1),
    ('Prefiro atrasar a entregar com falha.', 2),
    ('Aviso com antecedência e renegocio.', 3),
    ('Puxo gente para ajudar e viro a noite se precisar.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (2, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (3, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (4, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q13 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'O tipo de chefe com quem você trabalha melhor:', 'forced_choice', 13, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q13.id, v.label, v.ord from q13, (values
    ('Que dá autonomia e cobra resultado.', 1),
    ('Que é aberto e conversa fácil.', 2),
    ('Que dá segurança e não muda o rumo toda hora.', 3),
    ('Que explica o critério das decisões.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (2, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (3, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (4, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q14 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Alguém discorda de você numa reunião cheia.', 'forced_choice', 14, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "conflito"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q14.id, v.label, v.ord from q14, (values
    ('Levo na leveza para não esfriar a sala.', 1),
    ('Deixo passar e converso depois em particular.', 2),
    ('Peço o argumento e comparo com o que eu tenho.', 3),
    ('Rebato ali mesmo.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (2, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (3, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (4, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q15 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Do que você tem mais receio no trabalho:', 'forced_choice', 15, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q15.id, v.label, v.ord from q15, (values
    ('De um conflito aberto com alguém do time.', 1),
    ('De perder o controle da situação.', 2),
    ('De ser ignorado ou deixado de fora.', 3),
    ('De entregar alguma coisa com erro.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (2, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (3, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (4, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q16 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Como você toma uma decisão importante:', 'forced_choice', 16, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "decisao"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q16.id, v.label, v.ord from q16, (values
    ('Levanto tudo o que der e comparo.', 1),
    ('Bato o martelo rápido e sigo.', 2),
    ('Consulto quem vai ser afetado.', 3),
    ('Vou pelo que me entusiasma e converso enquanto decido.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (2, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (3, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (4, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q17 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Numa apresentação para muita gente:', 'forced_choice', 17, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q17.id, v.label, v.ord from q17, (values
    ('Vou direto ao ponto principal.', 1),
    ('Prefiro que outra pessoa apresente.', 2),
    ('Me solto e improviso.', 3),
    ('Ensaio antes e sigo o roteiro.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (2, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (3, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (4, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q18 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'O que costuma te fazer perder a paciência:', 'forced_choice', 18, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q18.id, v.label, v.ord from q18, (values
    ('Gente fechada, que não se abre.', 1),
    ('Pressão e clima tenso.', 2),
    ('Trabalho malfeito.', 3),
    ('Lentidão para decidir.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (2, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (3, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (4, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q19 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'O time está desanimado.', 'forced_choice', 19, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q19.id, v.label, v.ord from q19, (values
    ('Ouço um a um para entender o que houve.', 1),
    ('Mostro onde está o problema e o caminho de saída.', 2),
    ('Redefino a meta e puxo o time.', 3),
    ('Levanto o astral e chamo para cima.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (2, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (3, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (4, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q20 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Você discorda de uma decisão que o grupo já tomou.', 'forced_choice', 20, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q20.id, v.label, v.ord from q20, (values
    ('Registro minha ressalva e cumpro.', 1),
    ('Sigo junto para não dividir o time.', 2),
    ('Converso nos bastidores para sentir quem pensa igual.', 3),
    ('Falo que discordo e proponho outra coisa.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (2, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (3, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (4, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q21 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Você prefere ser visto como:', 'forced_choice', 21, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "imagem"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q21.id, v.label, v.ord from q21, (values
    ('Alguém confiável.', 1),
    ('Alguém empolgante.', 2),
    ('Alguém firme.', 3),
    ('Alguém correto.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (2, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (3, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (4, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q22 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'No fim de um projeto puxado, o que te deixa satisfeito:', 'forced_choice', 22, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q22.id, v.label, v.ord from q22, (values
    ('Ter mantido o time inteiro até o fim.', 1),
    ('Ter batido a meta.', 2),
    ('Ter feito certo.', 3),
    ('Ter sido uma boa experiência para todo mundo.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (2, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (3, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (4, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q23 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Quando você precisa cobrar alguém:', 'forced_choice', 23, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "cobranca"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q23.id, v.label, v.ord from q23, (values
    ('Mostro o que foi combinado, por escrito.', 1),
    ('Faço da conversa algo leve.', 2),
    ('Cobro direto, assim que percebo.', 3),
    ('Adio até não dar mais.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (2, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (3, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (4, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q24 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Uma regra da empresa está atrapalhando o resultado.', 'forced_choice', 24, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q24.id, v.label, v.ord from q24, (values
    ('Passo por cima e resolvo.', 1),
    ('Sigo a regra para não criar problema.', 2),
    ('Sigo a regra e proponho mudá-la.', 3),
    ('Falo com quem pode abrir uma exceção.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (2, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (3, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (4, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q25 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Como você lida com risco:', 'forced_choice', 25, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q25.id, v.label, v.ord from q25, (values
    ('Prefiro o caminho seguro.', 1),
    ('Só avanço com o risco medido.', 2),
    ('Aceito o risco quando o ganho é grande.', 3),
    ('Vou pelo entusiasmo e aposto.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (2, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (3, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (4, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q26 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Uma mudança grande é anunciada. Sua primeira pergunta:', 'forced_choice', 26, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q26.id, v.label, v.ord from q26, (values
    ('Qual foi o critério para decidir isso?', 1),
    ('O que eu preciso fazer, e até quando?', 2),
    ('Quem vai comigo nessa?', 3),
    ('O que muda para quem já estava aqui?', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (2, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (3, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (4, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q27 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Você travou num problema.', 'forced_choice', 27, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "destravar"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q27.id, v.label, v.ord from q27, (values
    ('Falo com alguém para destravar.', 1),
    ('Volto ao começo e refaço passo a passo.', 2),
    ('Tento outra saída e forço até sair.', 3),
    ('Deixo descansar e volto depois.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (2, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (3, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1),
    (4, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q28 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('507bdcc1-c22e-40ae-a507-a45a38a9ebaa', 'Se tivesse que abrir mão de uma coisa no trabalho:', 'forced_choice', 28, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q28.id, v.label, v.ord from q28, (values
    ('Abriria mão da estabilidade.', 1),
    ('Abriria mão do capricho.', 2),
    ('Abriria mão do convívio.', 3),
    ('Abriria mão do controle.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '3194da7d-4885-4773-a338-999a5cea2c6e'::uuid, 1),
    (2, 'b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d'::uuid, 1),
    (3, '8171b75f-46f4-403d-9a8a-e9f6bb89172d'::uuid, 1),
    (4, 'd9cc9210-0a11-4491-952c-4fdffa8045b2'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;
