-- "Sua aula e amanha." O aviso da vespera, sem agendador.
--
-- POR QUE NAO E UM CRON
--
-- A primeira ideia obvia e pg_cron rodando as 8h e disparando os avisos do dia
-- seguinte. Para e-mail seria o certo. Para o SINO, e a arquitetura errada: a
-- notificacao do sino so tem efeito quando a pessoa abre a plataforma. Um cron
-- gravaria linhas as 8h para gente que so entra as 22h -- mesmo resultado, mais
-- uma extensao para manter, e uma fila que enche sozinha para quem nunca entra.
--
-- Entao o aviso e CALCULADO NA LEITURA: quando alguem abre a plataforma, o sino
-- pergunta "tem compromisso meu nas proximas 24h que ainda nao virou aviso?" e
-- grava o que faltava. Quem nao abre nao acumula nada.
--
-- A CHAVE DE IDEMPOTENCIA
--
-- Sem trava, cada F5 criaria um aviso novo -- o sino viraria uma coluna de
-- linhas identicas em dez minutos. `notificacoes` nao tem coluna de referencia,
-- e acrescentar uma so para isto mexeria numa tabela que ja funciona. O `link`
-- ja identifica o compromisso ("/aluno/classroom?aula=<uuid>"), e tipo + link +
-- destinatario e exatamente "este aviso, para esta pessoa, sobre esta aula".
--
-- Indice UNICO parcial, so para os tipos de vespera: os outros avisos PODEM
-- repetir (dois comentarios no mesmo post sao dois avisos) e nao podem cair
-- nesta trava.

CREATE UNIQUE INDEX IF NOT EXISTS notif_vespera_unica
  ON public.notificacoes (user_id, tipo, link)
  WHERE tipo IN ('vespera_aula', 'vespera_devolutiva');

/**
 * Grava os avisos de vespera que faltam para quem chamou. Devolve quantos criou.
 *
 * SECURITY DEFINER porque `notificacoes` nao tem policy de INSERT para
 * `authenticated` -- e nao pode ter: insercao livre deixaria qualquer um
 * plantar aviso no sino de outra pessoa. A funcao so escreve para `auth.uid()`,
 * entao nao ha o que abusar.
 *
 * A JANELA e "daqui ate 24h". Nao e "amanha" no calendario: quem abre a
 * plataforma as 23h de segunda precisa ver a aula das 8h de terca, e uma regra
 * de dia civil esconderia justamente esse caso.
 */
CREATE OR REPLACE FUNCTION public.avisos_da_vespera()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_n integer := 0;
  v_criados integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;

  -- ---- Aulas presenciais das proximas 24h ----
  --
  -- So aula com data, nao cancelada e ainda nao fechada. E so para quem esta
  -- na turma: o vinculo vem de group_members cruzado com treinamento_grupos,
  -- que e a mesma corrente que autoriza o check-in.
  INSERT INTO public.notificacoes (user_id, conta_id, tipo, titulo, corpo, link)
  SELECT DISTINCT
         v_uid,
         t.mentor_id,
         'vespera_aula',
         'Amanha: ' || a.titulo,
         to_char(a.comeca_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "as" HH24:MI')
           || COALESCE(' · ' || a.local, ''),
         '/aluno/classroom/' || t.id
    FROM public.treinamento_aulas a
    JOIN public.treinamento_modulos m ON m.id = a.modulo_id
    JOIN public.treinamentos t        ON t.id = m.treinamento_id
    JOIN public.treinamento_grupos tg ON tg.treinamento_id = t.id
    JOIN public.group_members gm      ON gm.group_id = tg.group_id
    JOIN public.people pe             ON pe.id = gm.person_id AND pe.user_id = v_uid
   WHERE a.comeca_em IS NOT NULL
     AND NOT a.cancelada
     AND a.fechada_em IS NULL
     AND a.comeca_em > now()
     AND a.comeca_em <= now() + interval '24 hours'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_criados = ROW_COUNT;
  v_n := v_n + v_criados;

  -- ---- Devolutivas agendadas das proximas 24h ----
  --
  -- Os DOIS lados recebem: quem conduz e quem vai ser atendido. Avisar so o
  -- avaliado deixaria o mentor descobrir a agenda do dia abrindo a agenda -- e
  -- ele e quem precisa se preparar.
  INSERT INTO public.notificacoes (user_id, conta_id, tipo, titulo, corpo, link)
  SELECT DISTINCT
         v_uid,
         d.mentor_id,
         'vespera_devolutiva',
         'Amanha: devolutiva com ' || COALESCE(pe.full_name, 'seu mentor'),
         to_char(d.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "as" HH24:MI'),
         '/devolutivas'
    FROM public.devolutivas d
    LEFT JOIN public.people pe ON pe.id = d.person_id
   WHERE d.scheduled_at IS NOT NULL
     -- Cancelada nao avisa, e realizada tampouco: as duas continuam com
     -- scheduled_at preenchido, e sem este filtro uma devolutiva ja concluida
     -- reapareceria como "amanha".
     AND d.status = 'agendada'
     AND d.scheduled_at > now()
     AND d.scheduled_at <= now() + interval '24 hours'
     AND (d.mentor_id = v_uid OR pe.user_id = v_uid)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_criados = ROW_COUNT;
  v_n := v_n + v_criados;

  RETURN v_n;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.avisos_da_vespera() TO authenticated;
