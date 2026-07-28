-- Valores (Spranger) — 30 blocos situacionais, cobertura e posição equilibradas.
-- Gerado por scripts/aplicar_conteudo.py a partir do módulo de conteúdo.

delete from public.test_questions where version_id = 'facb3043-ae0a-4162-81da-1262680939f5';

with q01 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Uma tarde inteira livre, sem cobrança nenhuma. Você:', 'forced_choice', 1, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "tempo_livre"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q01.id, v.label, v.ord from q01, (values
    ('Vou fundo num assunto que me deu curiosidade.', 1),
    ('Adianto algo que vai me poupar tempo ou dinheiro depois.', 2),
    ('Faço alguma coisa bonita, sem utilidade nenhuma.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1),
    (2, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1),
    (3, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q02 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Você recebe um dinheiro que não esperava, o bastante para fazer diferença.', 'forced_choice', 2, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "dinheiro"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q02.id, v.label, v.ord from q02, (values
    ('Divido com quem está passando aperto.', 1),
    ('Uso para chegar onde eu quero chegar.', 2),
    ('Dou um destino que me deixe em paz comigo.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1),
    (2, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1),
    (3, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q03 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Escolhendo um curso para fazer:', 'forced_choice', 3, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q03.id, v.label, v.ord from q03, (values
    ('O que se paga mais rápido.', 1),
    ('O que me explica como as coisas funcionam.', 2),
    ('O que me deixa mais útil para as pessoas.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1),
    (2, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1),
    (3, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q04 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Do que você não abre mão num trabalho:', 'forced_choice', 4, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "inegociavel"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q04.id, v.label, v.ord from q04, (values
    ('De fazer com capricho, que dê gosto de ver.', 1),
    ('De não trair o que eu acredito.', 2),
    ('De ter voz nas decisões.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1),
    (2, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1),
    (3, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q05 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Numa discussão sobre o rumo da empresa, o argumento que mais te convence:', 'forced_choice', 5, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q05.id, v.label, v.ord from q05, (values
    ('O que nos deixa numa posição mais forte.', 1),
    ('O que explica melhor a causa do problema.', 2),
    ('O que dá mais retorno pelo esforço.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1),
    (2, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1),
    (3, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q06 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'O que faz um ambiente ser bom para você:', 'forced_choice', 6, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q06.id, v.label, v.ord from q06, (values
    ('Que tenha um sentido, não só função.', 1),
    ('Que seja bonito e bem cuidado.', 2),
    ('Que as pessoas se deem bem ali.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1),
    (2, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1),
    (3, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q07 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Você descobre que o jeito como sempre fez uma coisa estava errado.', 'forced_choice', 7, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "erro"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q07.id, v.label, v.ord from q07, (values
    ('Quero saber quanto isso custou.', 1),
    ('Me incomoda ter feito errado sem perceber.', 2),
    ('Quero entender onde estava o erro.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1),
    (2, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1),
    (3, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q08 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'O elogio que te deixa mais satisfeito:', 'forced_choice', 8, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q08.id, v.label, v.ord from q08, (values
    ('“Ficou bonito.”', 1),
    ('“Foi você que puxou isso.”', 2),
    ('“Você me ajudou muito.”', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1),
    (2, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1),
    (3, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q09 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Visitando uma cidade nova, você faz questão de:', 'forced_choice', 9, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "cultura"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q09.id, v.label, v.ord from q09, (values
    ('Entender a história do lugar.', 1),
    ('Conversar com quem mora ali.', 2),
    ('Ver o que tem de mais bonito.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1),
    (2, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1),
    (3, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q10 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Uma proposta paga muito bem, mas te afasta do que você acredita.', 'forced_choice', 10, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q10.id, v.label, v.ord from q10, (values
    ('Aceitaria se me colocasse num lugar de mais influência.', 1),
    ('Aceitaria: segurança financeira vem primeiro.', 2),
    ('Recusaria, mesmo perdendo a oportunidade.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1),
    (2, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1),
    (3, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q11 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'O que te faz admirar alguém:', 'forced_choice', 11, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q11.id, v.label, v.ord from q11, (values
    ('Ter bom gosto e cuidado com a forma.', 1),
    ('Ter presença e ser ouvido.', 2),
    ('Saber muito sobre aquilo de que fala.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1),
    (2, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1),
    (3, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q12 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Sobrou uma hora no fim do dia.', 'forced_choice', 12, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q12.id, v.label, v.ord from q12, (values
    ('Ligo para alguém que está precisando.', 1),
    ('Paro para pensar na vida.', 2),
    ('Resolvo alguma pendência prática.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1),
    (2, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1),
    (3, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q13 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Um bom livro, para você, é o que:', 'forced_choice', 13, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q13.id, v.label, v.ord from q13, (values
    ('Mexe com o que eu penso sobre a vida.', 1),
    ('É bem escrito e dá prazer ler.', 2),
    ('Explica alguma coisa que eu não sabia.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1),
    (2, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1),
    (3, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q14 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Montando um time do zero, sua primeira preocupação:', 'forced_choice', 14, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q14.id, v.label, v.ord from q14, (values
    ('Que caiba no orçamento.', 1),
    ('Que as pessoas se deem bem.', 2),
    ('Que eu fique com as rédeas.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1),
    (2, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1),
    (3, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q15 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'O que você quer que digam do seu trabalho daqui a dez anos:', 'forced_choice', 15, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q15.id, v.label, v.ord from q15, (values
    ('Que foi feito com rigor.', 1),
    ('Que mudou o rumo das coisas.', 2),
    ('Que ajudou gente de verdade.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1),
    (2, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1),
    (3, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q16 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Comprando uma coisa cara para você:', 'forced_choice', 16, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q16.id, v.label, v.ord from q16, (values
    ('Peso se eu preciso mesmo disso.', 1),
    ('Peso durabilidade e preço.', 2),
    ('Peso o quanto me agrada olhar e usar.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1),
    (2, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1),
    (3, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q17 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'O que mais te incomoda numa notícia ruim:', 'forced_choice', 17, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q17.id, v.label, v.ord from q17, (values
    ('As pessoas que vão sofrer com aquilo.', 1),
    ('Ninguém entender a causa do problema.', 2),
    ('O tanto que a gente se afastou do que importa.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1),
    (2, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1),
    (3, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q18 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Um projeto seu vai ser apresentado. Você se preocupa mais com:', 'forced_choice', 18, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q18.id, v.label, v.ord from q18, (values
    ('Quem vai estar na sala.', 1),
    ('A apresentação ficar impecável.', 2),
    ('Os números fecharem.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1),
    (2, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1),
    (3, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q19 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'O que te dá mais satisfação:', 'forced_choice', 19, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q19.id, v.label, v.ord from q19, (values
    ('Finalmente entender uma coisa difícil.', 1),
    ('Ver a minha ideia ser adotada.', 2),
    ('Sentir que estou no caminho certo.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1),
    (2, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1),
    (3, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q20 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Organizando um evento, seu foco:', 'forced_choice', 20, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q20.id, v.label, v.ord from q20, (values
    ('Não estourar o custo.', 1),
    ('Ficar bonito e bem feito.', 2),
    ('Todo mundo se sentir bem.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1),
    (2, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1),
    (3, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q21 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Um sábado sem compromisso nenhum. O que você faria com gosto:', 'forced_choice', 21, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "tempo_livre"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q21.id, v.label, v.ord from q21, (values
    ('Fazer alguma coisa bonita, só pelo prazer.', 1),
    ('Ler sobre algo que me deu vontade de entender.', 2),
    ('Deixar resolvido o que ia me atrapalhar depois.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1),
    (2, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1),
    (3, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q22 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Caiu um dinheiro extra na sua conta.', 'forced_choice', 22, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "dinheiro"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q22.id, v.label, v.ord from q22, (values
    ('Daria um destino que me deixasse tranquilo.', 1),
    ('Ajudaria alguém próximo.', 2),
    ('Investiria em mim, para crescer.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1),
    (2, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1),
    (3, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q23 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Escolhendo entre dois empregos com o mesmo salário:', 'forced_choice', 23, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q23.id, v.label, v.ord from q23, (values
    ('Fico com o que tem gente melhor para conviver.', 1),
    ('Fico com o que tem mais estabilidade e benefício.', 2),
    ('Fico com o que me ensina mais.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1),
    (2, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1),
    (3, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q24 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'O que você não aceitaria perder no trabalho:', 'forced_choice', 24, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "inegociavel"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q24.id, v.label, v.ord from q24, (values
    ('O espaço para influenciar o rumo.', 1),
    ('A coerência com o que eu acredito.', 2),
    ('O capricho de entregar coisa bem feita.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1),
    (2, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1),
    (3, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q25 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Alguém te pede conselho sobre uma decisão grande.', 'forced_choice', 25, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q25.id, v.label, v.ord from q25, (values
    ('Ajudo a pessoa a entender o problema direito.', 1),
    ('Faço com ela a conta do que compensa.', 2),
    ('Digo qual caminho deixa ela mais forte.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1),
    (2, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1),
    (3, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q26 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Uma festa que você organizou. Deu certo se:', 'forced_choice', 26, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q26.id, v.label, v.ord from q26, (values
    ('Ficou bonita.', 1),
    ('Todo mundo se sentiu à vontade.', 2),
    ('Teve algum significado, não foi só festa.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1),
    (2, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1),
    (3, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q27 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Você percebe que vinha errando havia meses.', 'forced_choice', 27, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "erro"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q27.id, v.label, v.ord from q27, (values
    ('Primeiro me cobro por ter deixado passar.', 1),
    ('Primeiro quero entender por que não vi antes.', 2),
    ('Primeiro quero saber o tamanho do prejuízo.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1),
    (2, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1),
    (3, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q28 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'O que faz um líder ser bom, na sua opinião:', 'forced_choice', 28, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q28.id, v.label, v.ord from q28, (values
    ('Saber conduzir e decidir.', 1),
    ('Cuidar das pessoas.', 2),
    ('Cuidar de como as coisas são feitas.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1),
    (2, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1),
    (3, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q29 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Num museu ou centro cultural, o que te prende:', 'forced_choice', 29, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "cultura"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q29.id, v.label, v.ord from q29, (values
    ('As histórias das pessoas envolvidas.', 1),
    ('A beleza das peças.', 2),
    ('A explicação, o contexto.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '601ce9b7-e452-4aa0-b27b-bbb1ba2b001a'::uuid, 1),
    (2, '6da588e1-b25f-4a7a-864d-792c35bd5057'::uuid, 1),
    (3, '0da4ae12-eff9-420d-8b42-687d190e9018'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q30 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('facb3043-ae0a-4162-81da-1262680939f5', 'Você precisa dizer não a alguém importante.', 'forced_choice', 30, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q30.id, v.label, v.ord from q30, (values
    ('Digo não quando o custo não compensa.', 1),
    ('Digo não quando fere o que eu acredito.', 2),
    ('Digo não quando me enfraquece.', 3)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae'::uuid, 1),
    (2, 'ef6a5018-f874-4746-8ae1-967d7ddeac0f'::uuid, 1),
    (3, '01877de3-c26c-4c6e-8b82-17775e6d04d0'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;
