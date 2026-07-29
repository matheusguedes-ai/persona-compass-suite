-- Conexão com o Google Calendar.
--
-- Etapa 4 de `docs/plano-menu-gestao.md`. Mão única, por decisão do Matheus: o
-- que é marcado na plataforma vai para o Google. Nada volta.
--
-- POR QUE GUARDAR O REFRESH TOKEN
--
-- O token de acesso do Google dura cerca de uma hora. Se a plataforma
-- dependesse dele, a sincronização só funcionaria enquanto a pessoa estivesse
-- com a sessão quente — e agendar uma devolutiva às 9h da manhã seguinte
-- falharia calado. O refresh token é o que permite renovar sozinho.
--
-- Ele é uma credencial de longa duração: quem o tiver age no calendário da
-- pessoa. Por isso a tabela é fechada — a RLS não deixa ninguém ler o token,
-- nem o próprio dono. Só o servidor, com service role, encosta nele.

CREATE TABLE IF NOT EXISTS public.google_conexoes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Segredo. Nunca sai do servidor.
  refresh_token text NOT NULL,
  -- A agenda secundária que a plataforma cria. Com o escopo
  -- `calendar.app.created`, é a ÚNICA em que ela pode mexer.
  calendar_id text,
  -- Só para a tela dizer "conectado como fulano@...".
  email text,
  conectado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_erro text,
  ultimo_uso_em timestamptz
);

ALTER TABLE public.google_conexoes ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy de SELECT, de propósito: `authenticated` não lê esta tabela.
-- Se houvesse, o refresh token trafegaria até o navegador — e um token que
-- chega ao navegador é um token vazado.
--
-- A tela precisa saber apenas SE está conectado e com qual e-mail; isso vem por
-- uma função que devolve só esses dois campos.

DROP POLICY IF EXISTS gc_delete ON public.google_conexoes;
CREATE POLICY gc_delete ON public.google_conexoes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

/**
 * O estado da conexão, sem o segredo.
 *
 * SECURITY DEFINER para atravessar a ausência de policy de SELECT. Devolve
 * `conectado` e `email` — nunca o token.
 */
CREATE OR REPLACE FUNCTION public.minha_conexao_google()
RETURNS TABLE (conectado boolean, email text, conectado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT true, g.email, g.conectado_em
    FROM public.google_conexoes g
   WHERE g.user_id = auth.uid();
$fn$;

GRANT EXECUTE ON FUNCTION public.minha_conexao_google() TO authenticated;


-- O evento que a plataforma criou lá, para saber o que atualizar depois.
--
-- Sem isto, remarcar uma devolutiva criaria um segundo evento no Google em vez
-- de mover o primeiro, e o calendário encheria de duplicatas.
CREATE TABLE IF NOT EXISTS public.google_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- De onde veio: uma devolutiva ou um evento da agenda.
  origem text NOT NULL CHECK (origem IN ('devolutiva', 'evento')),
  origem_id uuid NOT NULL,
  google_event_id text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS google_eventos_origem_uk
  ON public.google_eventos (user_id, origem, origem_id);

ALTER TABLE public.google_eventos ENABLE ROW LEVEL SECURITY;
-- Mesma lógica: tabela de serviço, sem leitura pelo cliente.
