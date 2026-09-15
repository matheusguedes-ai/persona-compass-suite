-- #286 — o gatilho da avaliação de aula COM HORÁRIO passa de "terminou pelo
-- relógio" (termina_em <= now()) para "FOI FECHADA pelo mentor" (fechada_em
-- preenchido). O relógio não sabe se a chamada foi conferida; o fechamento
-- sabe. Mudança de comportamento intencional: aula que terminou mas não foi
-- fechada deixa de aceitar avaliação.
--
-- A regra da aula GRAVADA (#256, conclusão marcada pelo aluno) é reproduzida
-- linha a linha, sem nenhuma mudança.
--
-- Reabrir a lista (fechada_em volta a NULL) tranca avaliação NOVA sem apagar
-- as que já existem — nada aqui toca treinamento_avaliacoes na reabertura, a
-- trava só olha o estado ATUAL de fechada_em no momento do INSERT.
create or replace function public.avaliar_aula(
  _aula_id uuid,
  _estrelas integer,
  _comentario text
)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  _person_id uuid;
  _conta_id uuid;
  _comeca_em timestamptz;
  _fechada_em timestamptz;
begin
  if _estrelas is null or _estrelas < 1 or _estrelas > 5 then
    raise exception 'A nota precisa ser de 1 a 5.';
  end if;

  select a.comeca_em, a.fechada_em into _comeca_em, _fechada_em
    from public.treinamento_aulas a where a.id = _aula_id;

  if _comeca_em is null then
    -- #256 — aula gravada: quem concluiu pode avaliar. Intocado.
    select c.person_id into _person_id
      from public.treinamento_aula_conclusoes c
     where c.aula_id = _aula_id
       and c.person_id in (select public.my_person_ids())
     limit 1;
    if _person_id is null then
      raise exception 'Marque esta aula como concluída antes de avaliar.';
    end if;
  else
    -- #286 — aula com horário: fechada_em manda, não termina_em.
    if _fechada_em is null then
      raise exception 'Esta aula ainda não foi fechada pelo professor.';
    end if;
    select p.person_id into _person_id
      from public.treinamento_presencas p
     where p.aula_id = _aula_id
       and p.person_id in (select public.my_person_ids())
       and (p.situacao is null or p.situacao in ('presente', 'atrasado'))
     limit 1;
    if _person_id is null then
      raise exception 'Você não tem presença registrada nesta aula.';
    end if;
  end if;

  select t.mentor_id into _conta_id
    from public.treinamento_aulas a
    join public.treinamento_modulos m on m.id = a.modulo_id
    join public.treinamentos t on t.id = m.treinamento_id
   where a.id = _aula_id;

  insert into public.treinamento_avaliacoes (aula_id, person_id, conta_id, estrelas, comentario)
  values (_aula_id, _person_id, _conta_id, _estrelas, nullif(btrim(coalesce(_comentario, '')), ''));
exception
  when unique_violation then
    raise exception 'Você já avaliou esta aula.';
end;
$fn$;

revoke execute on function public.avaliar_aula(uuid, integer, text) from public, anon;
grant execute on function public.avaliar_aula(uuid, integer, text) to authenticated;
