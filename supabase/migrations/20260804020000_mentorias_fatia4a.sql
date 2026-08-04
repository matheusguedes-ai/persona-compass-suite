-- Menu Mentorias — Fatia 4a: o link de auto-agendamento (o que faz existir).
--
-- Especificação completa em docs/plano-mentorias-fatia4.md. Puramente
-- aditiva: duas tabelas novas (nascem com mentor_id, regra 2 da
-- constituição) e três colunas novas em mentoria_sessoes. Nada que está
-- publicado lê essas colunas ou tabelas hoje.
--
-- ============================================================
-- 1. mentoria_disponibilidade — quando o professor atende
--
-- Uma linha por faixa. Segunda 9h-12h e 14h-18h são duas linhas — como no
-- Google, que permite mais de uma faixa por dia.
--
-- hora_inicio/hora_fim são `time`, sem fuso — e são tratadas como hora de
-- Brasília SEMPRE, em todo o código que lê esta tabela. Isso só é seguro
-- porque o Brasil não observa mais horário de verão desde 2019: o
-- deslocamento America/Sao_Paulo é -03:00 o ano inteiro, sem exceção. Se
-- isso mudar de novo por lei, este comentário para de valer.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mentoria_disponibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo .. 6=sábado
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL CHECK (hora_fim > hora_inicio),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentoria_disponibilidade_mentor_idx
  ON public.mentoria_disponibilidade (mentor_id, dia_semana);

DROP TRIGGER IF EXISTS mentoria_disponibilidade_set_updated_at ON public.mentoria_disponibilidade;
CREATE TRIGGER mentoria_disponibilidade_set_updated_at
  BEFORE UPDATE ON public.mentoria_disponibilidade
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.mentoria_disponibilidade ENABLE ROW LEVEL SECURITY;

-- Mesmo desenho de `mentorias` (fatia 1): SELECT/INSERT/UPDATE/DELETE, todas
-- com mentor_id = acting_account(). A policy de SELECT companheira aqui é o
-- que faz o DELETE funcionar de verdade — ver 20260804010000, achado no
-- domínio próprio: a MESMA tabela sem uma policy de SELECT nunca chegou a
-- apagar linha nenhuma, mesmo dizendo sucesso.
CREATE POLICY mentoria_disponibilidade_read ON public.mentoria_disponibilidade
  FOR SELECT TO authenticated
  USING (mentor_id = public.acting_account());

CREATE POLICY mentoria_disponibilidade_insert ON public.mentoria_disponibilidade
  FOR INSERT TO authenticated
  WITH CHECK (mentor_id = public.acting_account());

CREATE POLICY mentoria_disponibilidade_update ON public.mentoria_disponibilidade
  FOR UPDATE TO authenticated
  USING (mentor_id = public.acting_account())
  WITH CHECK (mentor_id = public.acting_account());

CREATE POLICY mentoria_disponibilidade_delete ON public.mentoria_disponibilidade
  FOR DELETE TO authenticated
  USING (mentor_id = public.acting_account());

-- ============================================================
-- 2. mentoria_links — os links de auto-agendamento
--
-- slug é ÚNICO NO SCHEMA INTEIRO (não só por mentor): a URL pública
-- /agendar/$slug não carrega nenhum outro identificador do professor, então
-- o slug sozinho tem que apontar para exatamente um link, de um só dono.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mentoria_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL,
  descricao text,
  duracao_min integer NOT NULL CHECK (duracao_min > 0 AND duracao_min <= 480),
  intervalo_min integer NOT NULL DEFAULT 0 CHECK (intervalo_min >= 0 AND intervalo_min <= 480),
  antecedencia_min_horas integer NOT NULL DEFAULT 0 CHECK (antecedencia_min_horas >= 0),
  antecedencia_max_dias integer NOT NULL DEFAULT 60 CHECK (antecedencia_max_dias > 0 AND antecedencia_max_dias <= 365),
  teto_por_dia integer CHECK (teto_por_dia IS NULL OR teto_por_dia > 0), -- null = sem teto
  -- Colunas da 4b, já nomeadas aqui para a tabela não precisar de outro ALTER
  -- quando aquela fatia chegar — mas SEM leitor nenhum ainda. false/false não
  -- muda nada do que a 4a faz.
  usa_google_freebusy boolean NOT NULL DEFAULT false,
  permite_cancelar boolean NOT NULL DEFAULT false,
  permite_remarcar boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentoria_links_mentor_idx ON public.mentoria_links (mentor_id);

DROP TRIGGER IF EXISTS mentoria_links_set_updated_at ON public.mentoria_links;
CREATE TRIGGER mentoria_links_set_updated_at
  BEFORE UPDATE ON public.mentoria_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.mentoria_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY mentoria_links_read ON public.mentoria_links
  FOR SELECT TO authenticated
  USING (mentor_id = public.acting_account());

CREATE POLICY mentoria_links_insert ON public.mentoria_links
  FOR INSERT TO authenticated
  WITH CHECK (mentor_id = public.acting_account());

CREATE POLICY mentoria_links_update ON public.mentoria_links
  FOR UPDATE TO authenticated
  USING (mentor_id = public.acting_account())
  WITH CHECK (mentor_id = public.acting_account());

CREATE POLICY mentoria_links_delete ON public.mentoria_links
  FOR DELETE TO authenticated
  USING (mentor_id = public.acting_account());

-- A leitura pública (página /agendar/$slug, sem login) passa pela service
-- role no servidor — não por RLS. De propósito, sem policy nenhuma aqui para
-- `anon`: o service role já ignora RLS, e uma policy pública devolveria a
-- tabela inteira (inclusive links desativados de outros professores) a
-- qualquer chamada anônima direta ao PostgREST.

-- ============================================================
-- 3. mentoria_sessoes ganha origem, link_id e confirmado_em
-- ============================================================

ALTER TABLE public.mentoria_sessoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'link')),
  ADD COLUMN IF NOT EXISTS link_id uuid REFERENCES public.mentoria_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz;

CREATE INDEX IF NOT EXISTS mentoria_sessoes_link_idx ON public.mentoria_sessoes (link_id);

-- ============================================================
-- 4. Trava de corrida: duas pessoas não conseguem ocupar o mesmo horário do
-- mesmo professor ao mesmo tempo.
--
-- Não é o intervalo entre sessões (isso é regra de QUAIS horários oferecer,
-- resolvida na aplicação) — é a garantia dura de que duas sessões 'agendada'
-- do mesmo mentor_id nunca se sobrepõem no tempo, não importa quantos
-- pedidos cheguem juntos. Sessão manual sem termina_em conta como 60 min
-- para este efeito (mesmo padrão de fallback que sincronizar() já usa em
-- google.server.ts).
--
-- Conferido antes de escrever esta migração: hoje não existe NENHUMA sessão
-- com status='agendada' em produção — a constraint entra sem risco de
-- falhar por dado antigo.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- tstzrange, não tsrange: quando/termina_em são timestamptz. tsrange é para
-- timestamp SEM fuso — Postgres recusa com "function does not exist" se
-- usado aqui (achado ao aplicar, corrigido antes de publicar).
--
-- E o próprio tstzrange() não serve direto num índice: o Postgres marca o
-- construtor de range como STABLE, não IMMUTABLE (conservador quanto a fuso
-- horário), e EXCLUDE USING gist exige IMMUTABLE. Embrulhar num wrapper
-- IMMUTABLE é o jeito documentado de contornar essa checagem — mas o
-- Postgres confere TODA a árvore da expressão do índice, não só a função
-- mais externa: o fallback "quando + interval" tem de estar DENTRO do
-- wrapper, não na chamada. Fora, `timestamptz + interval` é o próprio
-- operador STABLE e reprova a checagem de novo, mesmo com o wrapper
-- IMMUTABLE por fora. É seguro assumir imutável aqui porque os dois
-- argumentos já chegam como timestamptz resolvido (não texto dependente de
-- fuso) e o intervalo usado é fixo em minutos, sem componente de mês/dia
-- (a fonte real da ambiguidade que faz o Postgres marcar o operador STABLE).
--
-- Repetida aqui de propósito (IF NOT EXISTS, então inofensiva): cada
-- tentativa anterior falhou nesta mesma transação, e o editor SQL do
-- Supabase roda o script inteiro num único bloco — o que veio antes do erro
-- também foi desfeito junto.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION public.intervalo_sessao(quando timestamptz, termina_em timestamptz)
RETURNS tstzrange
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT tstzrange(quando, COALESCE(termina_em, quando + interval '60 minutes'));
$$;

ALTER TABLE public.mentoria_sessoes
  ADD CONSTRAINT mentoria_sessoes_sem_sobreposicao
  EXCLUDE USING gist (
    mentor_id WITH =,
    public.intervalo_sessao(quando, termina_em) WITH &&
  ) WHERE (status = 'agendada');
