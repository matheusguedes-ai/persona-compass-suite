-- Menu Mentorias — Fatia 2: a voz do aluno.
--
-- PURAMENTE ADITIVA — regra 5 da constituição: três colunas novas, uma tabela
-- nova, uma função nova, um bucket novo. Nada é renomeado nem removido, então
-- não há janela de quebra e pode ir antes do código publicado.
--
-- Especificação completa em docs/plano-mentorias-fatia2.md.

-- ============================================================
-- 1. mentoria_sessoes ganha a avaliação do aluno
-- ============================================================
-- Sem tabela própria: a sessão é sempre 1:1, então há no máximo uma avaliação.

ALTER TABLE public.mentoria_sessoes
  ADD COLUMN IF NOT EXISTS avaliacao_estrelas integer
    CHECK (avaliacao_estrelas IS NULL OR avaliacao_estrelas BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS avaliacao_comentario text,
  ADD COLUMN IF NOT EXISTS avaliada_em timestamptz;

-- ============================================================
-- 2. mentoria_arquivos — anexos do resumo
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mentoria_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.mentoria_sessoes(id) ON DELETE CASCADE,
  -- Redundante de propósito, mesmo padrão de mentoria_tarefas: simplifica a RLS.
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  caminho text NOT NULL,
  tamanho_bytes integer NOT NULL CHECK (tamanho_bytes > 0),
  tipo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentoria_arquivos_sessao_idx ON public.mentoria_arquivos (sessao_id);

ALTER TABLE public.mentoria_arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mentoria_arquivos_read ON public.mentoria_arquivos;
CREATE POLICY mentoria_arquivos_read ON public.mentoria_arquivos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mentoria_sessoes s
        JOIN public.mentorias m ON m.id = s.mentoria_id
       WHERE s.id = mentoria_arquivos.sessao_id
         AND (
           (m.mentor_id = public.acting_account() AND public.can_see_person(m.person_id))
           OR (m.person_id IN (SELECT public.my_person_ids()) AND public.aluno_pode('mentorias'))
         )
    )
  );

-- Só o professor anexa — o aluno baixa, nunca envia (nenhuma policy de INSERT
-- para ele, por desenho).
DROP POLICY IF EXISTS mentoria_arquivos_insert ON public.mentoria_arquivos;
CREATE POLICY mentoria_arquivos_insert ON public.mentoria_arquivos FOR INSERT TO authenticated
  WITH CHECK (
    mentor_id = public.acting_account()
    AND EXISTS (
      SELECT 1 FROM public.mentoria_sessoes s
        JOIN public.mentorias m ON m.id = s.mentoria_id
       WHERE s.id = mentoria_arquivos.sessao_id
         AND m.mentor_id = public.acting_account()
         AND public.can_see_person(m.person_id)
         AND public.posso_agendar_mentoria(m.person_id)
    )
  );

-- Mesma simetria de mentoria_tarefas: o dono pode apagar o que é seu, mesmo
-- que esta fatia ainda não ofereça o botão na tela.
DROP POLICY IF EXISTS mentoria_arquivos_delete ON public.mentoria_arquivos;
CREATE POLICY mentoria_arquivos_delete ON public.mentoria_arquivos FOR DELETE TO authenticated
  USING (
    mentor_id = public.acting_account()
    AND EXISTS (
      SELECT 1 FROM public.mentoria_sessoes s
        JOIN public.mentorias m ON m.id = s.mentoria_id
       WHERE s.id = mentoria_arquivos.sessao_id
         AND m.mentor_id = public.acting_account()
         AND public.can_see_person(m.person_id)
         AND public.posso_agendar_mentoria(m.person_id)
    )
  );

-- ============================================================
-- 3. Avaliar a sessão — SÓ o aluno, SÓ concluída, UMA VEZ SÓ.
--
-- As três regras vivem na cláusula WHERE, não na tela: professor chamando
-- isto falha (não está em my_person_ids()); sessão agendada falha (status);
-- reenviar falha (avaliacao_estrelas já não é nulo). Mesmo padrão de
-- marcar_tarefa_mentoria().
-- ============================================================

CREATE OR REPLACE FUNCTION public.avaliar_sessao_mentoria(
  _sessao_id uuid,
  _estrelas integer,
  _comentario text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF _estrelas IS NULL OR _estrelas < 1 OR _estrelas > 5 THEN
    RAISE EXCEPTION 'A nota precisa ser de 1 a 5.';
  END IF;

  UPDATE public.mentoria_sessoes s
     SET avaliacao_estrelas = _estrelas,
         avaliacao_comentario = NULLIF(btrim(COALESCE(_comentario, '')), ''),
         avaliada_em = now()
   WHERE s.id = _sessao_id
     AND s.status = 'concluida'
     AND s.avaliacao_estrelas IS NULL
     AND EXISTS (
       SELECT 1 FROM public.mentorias m
        WHERE m.id = s.mentoria_id
          AND m.person_id IN (SELECT public.my_person_ids())
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível avaliar esta sessão — ela já pode ter sido avaliada, ainda não foi concluída, ou não é sua.';
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.avaliar_sessao_mentoria(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avaliar_sessao_mentoria(uuid, integer, text) TO authenticated;

-- ============================================================
-- 4. Bucket 'mentorias' — nasce PRIVADO, com limite e tipos.
--
-- Ao contrário de biblioteca/avatares (que nasceram públicos e custaram uma
-- demanda cada para fechar), este já nasce certo: public=false, e nenhuma
-- policy de SELECT em storage.objects — o mesmo padrão que a migração
-- 20260731050000 teve de aplicar DEPOIS para os outros dois. Ninguém assina
-- pelo navegador; só o servidor assina, pela service role, depois de
-- decidir se a pessoa pode ver aquele arquivo (storage-assinado.server.ts).
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('mentorias', 'mentorias', false, 20971520,  -- 20 MB
        ARRAY[
          'application/pdf',
          'image/png','image/jpeg','image/webp','image/heic','image/heif',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel',
          'text/csv',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-powerpoint',
          'text/plain'
        ])
ON CONFLICT (id) DO NOTHING;

-- Envia quem está logado, cada um na própria pasta — a autorização de
-- verdade (é o professor certo, da pessoa certa) é a RLS de mentoria_arquivos
-- acima; isto aqui só limita o estrago de uma sessão comprometida.
DROP POLICY IF EXISTS mentorias_arquivo_envio ON storage.objects;
CREATE POLICY mentorias_arquivo_envio ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mentorias' AND (storage.foldername(name))[1] = auth.uid()::text);
