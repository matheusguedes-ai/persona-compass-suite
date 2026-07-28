-- Temperamentos — 28 blocos sobre reação e ritmo (deixa de repetir o DISC).
-- Gerado por scripts/aplicar_conteudo.py a partir do módulo de conteúdo.

delete from public.test_questions where version_id = '58927961-a8de-4a60-8928-860f0c9e7788';

with q01 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Você recebe uma notícia ruim.', 'forced_choice', 1, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q01.id, v.label, v.ord from q01, (values
    ('Fico abalado rápido e passo rápido.', 1),
    ('Reajo na hora, e reajo forte.', 2),
    ('Fico remoendo por dias.', 3),
    ('Absorvo e sigo, quase sem mudar de cara.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (2, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (3, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (4, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q02 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Uma alegria inesperada.', 'forced_choice', 2, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "alegria"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q02.id, v.label, v.ord from q02, (values
    ('Espalho para todo mundo na hora.', 1),
    ('Comemoro e já penso no passo seguinte.', 2),
    ('Fico contente por dentro, sem alarde.', 3),
    ('Guardo para mim e saboreio devagar.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (2, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (3, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (4, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q03 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'O tipo de humor que combina com você:', 'forced_choice', 3, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q03.id, v.label, v.ord from q03, (values
    ('Humor fino, com camadas.', 1),
    ('Rir alto, de qualquer bobagem.', 2),
    ('Ironia afiada.', 3),
    ('Comentário seco, na hora certa.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (2, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (3, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (4, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q04 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Quando você se magoa com alguém:', 'forced_choice', 4, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "magoa"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q04.id, v.label, v.ord from q04, (values
    ('Nem sempre a pessoa percebe que eu me magoei.', 1),
    ('Fico chateado e no dia seguinte já passou.', 2),
    ('Não esqueço, mesmo perdoando.', 3),
    ('Explodo e depois esqueço.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (2, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (3, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (4, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q05 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Sua energia ao longo do dia:', 'forced_choice', 5, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "ritmo"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q05.id, v.label, v.ord from q05, (values
    ('Alta e constante, quase sem pausa.', 1),
    ('Sempre a mesma, sem picos.', 2),
    ('Vai e vem conforme o que está acontecendo.', 3),
    ('Boa em alguns horários, péssima em outros.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (2, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (3, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (4, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q06 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Começando um projeto novo:', 'forced_choice', 6, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "comeco"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q06.id, v.label, v.ord from q06, (values
    ('Começo empolgado e às vezes largo no meio.', 1),
    ('Começo sem pressa e sigo firme.', 2),
    ('Demoro a começar, planejando.', 3),
    ('Começo já querendo o resultado.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (2, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (3, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (4, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q07 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Numa mesa cheia de gente:', 'forced_choice', 7, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q07.id, v.label, v.ord from q07, (values
    ('Escuto mais do que falo.', 1),
    ('Domino a conversa sem perceber.', 2),
    ('Falo com todo mundo.', 3),
    ('Converso a fundo com uma ou duas pessoas.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (2, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (3, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (4, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q08 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'O que já reclamaram de você:', 'forced_choice', 8, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q08.id, v.label, v.ord from q08, (values
    ('Que sou ríspido.', 1),
    ('Que sou disperso.', 2),
    ('Que sou parado demais.', 3),
    ('Que sou pessimista.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (2, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (3, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (4, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q09 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Diante de uma injustiça:', 'forced_choice', 9, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q09.id, v.label, v.ord from q09, (values
    ('Falo alto na hora e depois esfrio.', 1),
    ('Fico com aquilo entalado por muito tempo.', 2),
    ('Me revolto e parto para cima.', 3),
    ('Acho ruim, mas não me mexo muito.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (2, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (3, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (4, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q10 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Vinte minutos de espera, sem nada para fazer.', 'forced_choice', 10, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q10.id, v.label, v.ord from q10, (values
    ('Fico na minha, pensando.', 1),
    ('Puxo assunto com alguém.', 2),
    ('Não me incomodo nem um pouco.', 3),
    ('Fico irritado com o tempo perdido.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (2, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (3, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (4, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q11 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Alguém te contraria na frente dos outros.', 'forced_choice', 11, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q11.id, v.label, v.ord from q11, (values
    ('Deixo quieto, não vale a briga.', 1),
    ('Fico calado e magoado.', 2),
    ('Rebato na hora.', 3),
    ('Levo na brincadeira.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (2, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (3, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (4, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q12 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'O que te tira do sério:', 'forced_choice', 12, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q12.id, v.label, v.ord from q12, (values
    ('Incompetência.', 1),
    ('Gente agitada demais.', 2),
    ('Superficialidade.', 3),
    ('Tédio.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (2, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (3, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (4, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q13 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Como você decide as coisas do dia a dia:', 'forced_choice', 13, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q13.id, v.label, v.ord from q13, (values
    ('Rápido, quase sem pensar.', 1),
    ('Pelo que me parece mais animado.', 2),
    ('Pesando tudo, e ainda fico na dúvida.', 3),
    ('Adiando até precisar mesmo.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (2, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (3, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (4, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q14 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Um momento de crise geral.', 'forced_choice', 14, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "crise"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q14.id, v.label, v.ord from q14, (values
    ('Tento manter o astral.', 1),
    ('Enxergo o pior cenário antes de todo mundo.', 2),
    ('Sou o mais calmo da sala.', 3),
    ('Assumo e mando.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (2, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (3, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (4, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q15 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Sobre planos e promessas:', 'forced_choice', 15, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q15.id, v.label, v.ord from q15, (values
    ('Prometo só o que tenho certeza.', 1),
    ('Prometo pouco e cobro cumprimento.', 2),
    ('Prometo empolgado e nem sempre cumpro.', 3),
    ('Evito prometer.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (2, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (3, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (4, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q16 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Quando você erra:', 'forced_choice', 16, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q16.id, v.label, v.ord from q16, (values
    ('Não faço drama.', 1),
    ('Reconheço rápido e vou adiante.', 2),
    ('Me cobro muito além do necessário.', 3),
    ('Rio de mim mesmo.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (2, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (3, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (4, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q17 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Combinaram uma coisa com você e desmarcaram em cima da hora.', 'forced_choice', 17, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q17.id, v.label, v.ord from q17, (values
    ('Fico bravo e falo.', 1),
    ('Fico pensando se foi por minha causa.', 2),
    ('Já arrumo outra coisa para fazer.', 3),
    ('Tudo bem, aproveito para descansar.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (2, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (3, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (4, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q18 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'O ritmo que combina com você:', 'forced_choice', 18, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "ritmo"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q18.id, v.label, v.ord from q18, (values
    ('Variado.', 1),
    ('O meu, sem interrupção.', 2),
    ('Tranquilo.', 3),
    ('Acelerado.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (2, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (3, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (4, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q19 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Como você demonstra afeto:', 'forced_choice', 19, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q19.id, v.label, v.ord from q19, (values
    ('Com gestos pensados, escolhidos.', 1),
    ('Estando por perto, em silêncio.', 2),
    ('Fazendo coisas pela pessoa.', 3),
    ('Falando e abraçando.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (2, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (3, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (4, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q20 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'O que você faz quando está triste:', 'forced_choice', 20, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q20.id, v.label, v.ord from q20, (values
    ('Espero passar.', 1),
    ('Me recolho e mergulho.', 2),
    ('Procuro gente.', 3),
    ('Me ocupo até passar.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (2, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (3, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (4, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q21 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Aquele projeto que você começou, algumas semanas depois:', 'forced_choice', 21, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "comeco"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q21.id, v.label, v.ord from q21, (values
    ('Continuo puxando, sem soltar.', 1),
    ('A empolgação do começo já esfriou.', 2),
    ('Só agora sinto que entendi direito.', 3),
    ('Sigo no mesmo passo do primeiro dia.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (2, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (3, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (4, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q22 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Um elogio em público:', 'forced_choice', 22, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "alegria"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q22.id, v.label, v.ord from q22, (values
    ('Fico sem graça e meio desconfiado.', 1),
    ('Recebo bem e sigo em frente.', 2),
    ('Agradeço e mudo de assunto.', 3),
    ('Adoro.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (2, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (3, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (4, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q23 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Sobre mudar de opinião:', 'forced_choice', 23, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q23.id, v.label, v.ord from q23, (values
    ('Mudo sem fazer alarde.', 1),
    ('Mudo com facilidade.', 2),
    ('Custa, mas quando mudo, mudo inteiro.', 3),
    ('Mudo devagar, e só com argumento.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (2, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (3, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (4, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q24 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Alguém precisa de você numa emergência.', 'forced_choice', 24, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "crise"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q24.id, v.label, v.ord from q24, (values
    ('Tomo a frente e resolvo.', 1),
    ('Penso em tudo que pode dar errado e me preparo.', 2),
    ('Fico firme, sem me abalar.', 3),
    ('Chego e mobilizo gente para ajudar.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (2, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (3, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (4, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q25 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'O que fica com você depois de uma discussão:', 'forced_choice', 25, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você.", "check_group": "magoa"}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q25.id, v.label, v.ord from q25, (values
    ('As frases, que ficam voltando.', 1),
    ('O cansaço.', 2),
    ('A vontade de ter razão.', 3),
    ('A vontade de fazer as pazes.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (2, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (3, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (4, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q26 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Uma mudança é imposta, sem te consultarem.', 'forced_choice', 26, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q26.id, v.label, v.ord from q26, (values
    ('Aceito e me adapto.', 1),
    ('Contesto.', 2),
    ('Acho graça e vou junto.', 3),
    ('Resisto por dentro.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (2, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (3, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (4, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q27 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'A pior semana possível para você seria:', 'forced_choice', 27, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q27.id, v.label, v.ord from q27, (values
    ('Sem falar com ninguém.', 1),
    ('Cheia de cobrança e correria.', 2),
    ('Sem poder resolver nada.', 3),
    ('Sem tempo para pensar.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (2, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (3, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1),
    (4, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;

with q28 as (
  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)
  values ('58927961-a8de-4a60-8928-860f0c9e7788', 'Se te descrevessem numa palavra só, você aceitaria:', 'forced_choice', 28, true, '{"hint": "Escolha a que MAIS e a que MENOS tem a ver com você."}'::jsonb)
  returning id
), o as (
  insert into public.test_options (question_id, label, sort_order)
  select q28.id, v.label, v.ord from q28, (values
    ('Profundo.', 1),
    ('Sereno.', 2),
    ('Alegre.', 3),
    ('Intenso.', 4)
  ) as v(label, ord) returning id, sort_order
)
insert into public.option_scores (option_id, dimension_id, points)
select o.id, v.dim, v.pts from o join (values
    (1, '9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b'::uuid, 1),
    (2, '51671b6b-34f3-4bd0-bb72-1a9ec5958a4d'::uuid, 1),
    (3, 'e824540a-6085-45e5-aa6a-efccdc674dfa'::uuid, 1),
    (4, '128461f3-1e0b-4d10-8ea9-33d2d60333dc'::uuid, 1)
  ) as v(ord, dim, pts) on v.ord = o.sort_order;
