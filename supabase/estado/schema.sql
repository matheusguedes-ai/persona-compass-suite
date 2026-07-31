-- RETRATO DO BANCO. Gerado por scripts/exportar_estado_banco.py.
-- Nao editar a mao: rode o script de novo.
--
-- Isto NAO substitui supabase/migrations/ -- elas sao a historia.
-- Isto e o resultado, para o `git diff` acusar policy que mudou
-- fora de migracao.

-- ===================== TABELAS =====================
-- ============ TABELA academy_banners ============
--   id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   imagem_url text NOT NULL
--   link_url text
--   titulo text
--   ordem integer NOT NULL
--   ativo boolean NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA action_plans ============
--   id uuid NOT NULL
--   response_id uuid NOT NULL
--   answers jsonb NOT NULL
--   updated_at timestamp with time zone NOT NULL

-- ============ TABELA assessment_responses ============
--   id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   person_id uuid NOT NULL
--   group_id uuid
--   status text NOT NULL
--   created_at timestamp with time zone NOT NULL
--   started_at timestamp with time zone
--   submitted_at timestamp with time zone
--   expires_at timestamp with time zone
--   attempt integer NOT NULL
--   previous_assessment_id uuid
--   canceled_at timestamp with time zone

-- ============ TABELA biblioteca_materiais ============
--   id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   titulo text NOT NULL
--   descricao text
--   url text NOT NULL
--   kind text NOT NULL
--   categoria text
--   created_at timestamp with time zone NOT NULL
--   capa_url text
--   pasta_id uuid

-- ============ TABELA biblioteca_material_destinos ============
--   id uuid NOT NULL
--   material_id uuid NOT NULL
--   group_id uuid
--   person_id uuid
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA biblioteca_pasta_destinos ============
--   id uuid NOT NULL
--   pasta_id uuid NOT NULL
--   group_id uuid
--   person_id uuid
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA biblioteca_pastas ============
--   id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   titulo text NOT NULL
--   descricao text
--   capa_url text
--   ordem integer NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA community_comments ============
--   id uuid NOT NULL
--   post_id uuid NOT NULL
--   author_id uuid NOT NULL
--   author_name text NOT NULL
--   body text NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA community_post_groups ============
--   post_id uuid NOT NULL
--   group_id uuid NOT NULL

-- ============ TABELA community_posts ============
--   id uuid NOT NULL
--   author_id uuid NOT NULL
--   author_name text NOT NULL
--   body text NOT NULL
--   file_url text
--   file_kind text
--   link_url text
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL

-- ============ TABELA community_reactions ============
--   post_id uuid NOT NULL
--   user_id uuid NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA devolutivas ============
--   id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   person_id uuid NOT NULL
--   response_id uuid
--   assessment_id uuid
--   status text NOT NULL
--   scheduled_at timestamp with time zone
--   completed_at timestamp with time zone
--   duration_min integer
--   notes text
--   agreements text
--   next_at date
--   created_by uuid
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL

-- ============ TABELA email_logs ============
--   id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   kind text NOT NULL
--   to_email text NOT NULL
--   subject text NOT NULL
--   response_id uuid
--   assessment_id uuid
--   person_id uuid
--   status text NOT NULL
--   provider_id text
--   error text
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA evento_destinos ============
--   id uuid NOT NULL
--   evento_id uuid NOT NULL
--   group_id uuid
--   person_id uuid

-- ============ TABELA eventos ============
--   id uuid NOT NULL
--   conta_id uuid NOT NULL
--   titulo text NOT NULL
--   descricao text
--   quando timestamp with time zone NOT NULL
--   duracao_min integer
--   criado_por uuid
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL
--   termina_em timestamp with time zone
--   imagem_url text
--   link_url text
--   aula_id uuid

-- ============ TABELA google_conexoes ============
--   user_id uuid NOT NULL
--   refresh_token text NOT NULL
--   calendar_id text
--   email text
--   conectado_em timestamp with time zone NOT NULL
--   ultimo_erro text
--   ultimo_uso_em timestamp with time zone

-- ============ TABELA google_eventos ============
--   id uuid NOT NULL
--   user_id uuid NOT NULL
--   origem text NOT NULL
--   origem_id uuid NOT NULL
--   google_event_id text NOT NULL
--   criado_em timestamp with time zone NOT NULL

-- ============ TABELA group_instruments ============
--   group_id uuid NOT NULL
--   instrument_id text NOT NULL
--   added_at timestamp with time zone NOT NULL
--   version_id uuid

-- ============ TABELA group_members ============
--   group_id uuid NOT NULL
--   person_id uuid NOT NULL
--   added_at timestamp with time zone NOT NULL

-- ============ TABELA groups ============
--   id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   name text NOT NULL
--   type text NOT NULL
--   description text
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL
--   areas_aluno text[]

-- ============ TABELA instruments ============
--   id text NOT NULL
--   name text NOT NULL
--   short_name text NOT NULL
--   category text NOT NULL
--   duration_min integer NOT NULL
--   description text
--   accent text
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL

-- ============ TABELA invite_links ============
--   id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   title text
--   version_ids uuid[] NOT NULL
--   group_id uuid
--   expires_at timestamp with time zone
--   max_responses integer
--   response_count integer NOT NULL
--   is_active boolean NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA learning_lessons ============
--   id uuid NOT NULL
--   track_id uuid NOT NULL
--   module_id uuid NOT NULL
--   title text NOT NULL
--   description text
--   video_url text
--   duration_min integer
--   sort_order integer NOT NULL
--   is_published boolean NOT NULL
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL

-- ============ TABELA learning_materials ============
--   id uuid NOT NULL
--   track_id uuid NOT NULL
--   lesson_id uuid NOT NULL
--   title text NOT NULL
--   url text NOT NULL
--   kind text NOT NULL
--   sort_order integer NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA learning_modules ============
--   id uuid NOT NULL
--   track_id uuid NOT NULL
--   parent_id uuid
--   title text NOT NULL
--   description text
--   sort_order integer NOT NULL
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL

-- ============ TABELA learning_progress ============
--   id uuid NOT NULL
--   lesson_id uuid NOT NULL
--   track_id uuid NOT NULL
--   user_id uuid NOT NULL
--   completed_at timestamp with time zone NOT NULL

-- ============ TABELA learning_track_destinos ============
--   id uuid NOT NULL
--   track_id uuid NOT NULL
--   group_id uuid
--   person_id uuid
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA learning_tracks ============
--   id uuid NOT NULL
--   owner_id uuid NOT NULL
--   title text NOT NULL
--   description text
--   cover_url text
--   audience text NOT NULL
--   is_published boolean NOT NULL
--   sort_order integer NOT NULL
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL

-- ============ TABELA mentors ============
--   id uuid NOT NULL
--   owner_id uuid NOT NULL
--   name text NOT NULL
--   email text NOT NULL
--   specialty text
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL

-- ============ TABELA notificacoes ============
--   id uuid NOT NULL
--   user_id uuid NOT NULL
--   conta_id uuid NOT NULL
--   tipo text NOT NULL
--   titulo text NOT NULL
--   corpo text
--   link text
--   ator_nome text
--   lida_em timestamp with time zone
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA option_scores ============
--   id uuid NOT NULL
--   option_id uuid NOT NULL
--   dimension_id uuid NOT NULL
--   points numeric NOT NULL

-- ============ TABELA people ============
--   id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   full_name text NOT NULL
--   email text NOT NULL
--   phone text
--   profession text
--   role_at_company text
--   role text NOT NULL
--   notes text
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL
--   invite_link_id uuid
--   user_id uuid
--   avatar_url text
--   perfil_visivel boolean NOT NULL

-- ============ TABELA pontos ============
--   id uuid NOT NULL
--   user_id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   acao text NOT NULL
--   pontos integer NOT NULL
--   referencia uuid
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA profiles ============
--   user_id uuid NOT NULL
--   full_name text
--   company_name text
--   brand_color text
--   logo_url text
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL
--   brand_accent_color text
--   support_email text
--   site_url text
--   invite_message text
--   reminder_message text
--   result_message text
--   report_allow_pdf boolean NOT NULL
--   report_show_brand boolean NOT NULL
--   report_hidden_blocks text[] NOT NULL
--   avatar_url text
--   email_from text
--   company_cnpj text
--   company_phone text
--   company_seal_name text

-- ============ TABELA report_content ============
--   id uuid NOT NULL
--   version_id uuid
--   section text NOT NULL
--   dimension_key text NOT NULL
--   mode text NOT NULL
--   band_min numeric
--   band_max numeric
--   title text
--   body text NOT NULL
--   sort_order integer NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA team_member_groups ============
--   team_member_id uuid NOT NULL
--   group_id uuid NOT NULL
--   can_download_reports boolean NOT NULL
--   created_at timestamp with time zone NOT NULL
--   can_schedule_devolutivas boolean NOT NULL

-- ============ TABELA team_members ============
--   id uuid NOT NULL
--   owner_id uuid NOT NULL
--   user_id uuid
--   kind text NOT NULL
--   name text NOT NULL
--   email text NOT NULL
--   status text NOT NULL
--   invite_token uuid NOT NULL
--   invite_expires_at timestamp with time zone
--   accepted_at timestamp with time zone
--   permissions text[] NOT NULL
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL
--   person_id uuid

-- ============ TABELA test_answers ============
--   id uuid NOT NULL
--   response_id uuid NOT NULL
--   question_id uuid NOT NULL
--   payload jsonb NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA test_dimensions ============
--   id uuid NOT NULL
--   version_id uuid NOT NULL
--   key text NOT NULL
--   label text NOT NULL
--   description text
--   color text
--   sort_order integer NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA test_options ============
--   id uuid NOT NULL
--   question_id uuid NOT NULL
--   label text NOT NULL
--   value text
--   sort_order integer NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA test_questions ============
--   id uuid NOT NULL
--   version_id uuid NOT NULL
--   type question_type NOT NULL
--   prompt text NOT NULL
--   helper text
--   required boolean NOT NULL
--   sort_order integer NOT NULL
--   config jsonb NOT NULL
--   created_at timestamp with time zone NOT NULL

-- ============ TABELA test_responses ============
--   id uuid NOT NULL
--   version_id uuid NOT NULL
--   person_id uuid NOT NULL
--   group_id uuid
--   mentor_id uuid NOT NULL
--   status text NOT NULL
--   computed_scores jsonb
--   dominant_dimension_id uuid
--   result_band_id uuid
--   started_at timestamp with time zone
--   submitted_at timestamp with time zone
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL
--   kind text NOT NULL
--   parent_response_id uuid
--   rater_name text
--   assessment_response_id uuid
--   assessment_sort integer NOT NULL
--   expires_at timestamp with time zone
--   attempt integer NOT NULL
--   previous_response_id uuid
--   canceled_at timestamp with time zone

-- ============ TABELA test_result_bands ============
--   id uuid NOT NULL
--   version_id uuid NOT NULL
--   dimension_id uuid
--   min_score numeric NOT NULL
--   max_score numeric NOT NULL
--   title text NOT NULL
--   description text
--   sort_order integer NOT NULL
--   created_at timestamp with time zone NOT NULL
--   mode text NOT NULL

-- ============ TABELA test_versions ============
--   id uuid NOT NULL
--   instrument_id text NOT NULL
--   mentor_id uuid
--   title text NOT NULL
--   description text
--   is_template boolean NOT NULL
--   is_published boolean NOT NULL
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL
--   derived_config jsonb

-- ============ TABELA treinamento_anotacoes ============
--   aula_id uuid NOT NULL
--   texto text NOT NULL
--   updated_at timestamp with time zone NOT NULL

-- ============ TABELA treinamento_aulas ============
--   id uuid NOT NULL
--   modulo_id uuid NOT NULL
--   titulo text NOT NULL
--   descricao text
--   comeca_em timestamp with time zone
--   termina_em timestamp with time zone
--   local text
--   ordem integer NOT NULL
--   fechada_em timestamp with time zone
--   fechada_por uuid
--   cancelada boolean NOT NULL
--   local_lat double precision
--   local_lng double precision
--   local_raio_m integer NOT NULL
--   local_travado_em timestamp with time zone

-- ============ TABELA treinamento_grupos ============
--   treinamento_id uuid NOT NULL
--   group_id uuid NOT NULL

-- ============ TABELA treinamento_materiais ============
--   id uuid NOT NULL
--   aula_id uuid NOT NULL
--   titulo text NOT NULL
--   url text NOT NULL
--   kind text NOT NULL
--   ordem integer NOT NULL
--   created_at timestamp with time zone NOT NULL
--   visivel_aluno boolean NOT NULL

-- ============ TABELA treinamento_modulos ============
--   id uuid NOT NULL
--   treinamento_id uuid NOT NULL
--   titulo text NOT NULL
--   ordem integer NOT NULL

-- ============ TABELA treinamento_presencas ============
--   id uuid NOT NULL
--   aula_id uuid NOT NULL
--   person_id uuid NOT NULL
--   group_id uuid
--   origem text NOT NULL
--   escaneado_em timestamp with time zone
--   registrado_em timestamp with time zone NOT NULL
--   registrado_por uuid
--   observacao text
--   situacao text
--   passe_nonce text
--   group_nome text
--   marcado_por_nome text
--   distancia_m integer

-- ============ TABELA treinamentos ============
--   id uuid NOT NULL
--   mentor_id uuid NOT NULL
--   titulo text NOT NULL
--   descricao text
--   capa_url text
--   publicado boolean NOT NULL
--   created_at timestamp with time zone NOT NULL
--   updated_at timestamp with time zone NOT NULL
--   tolerancia_atraso_min integer NOT NULL

-- ===================== POLICIES =====================
-- policy academy_banners.banner_read [SELECT]
--   USING ((mentor_id = acting_account()) OR ((mentor_id IN ( SELECT p.mentor_id
   FROM people p
  WHERE (p.user_id = auth.uid()))) AND aluno_pode('academy'::text)))
--   CHECK -
-- policy academy_banners.banner_write [ALL]
--   USING (mentor_id = auth.uid())
--   CHECK (mentor_id = auth.uid())
-- policy assessment_responses.ar_all_own [ALL]
--   USING ((mentor_id = acting_account()) AND can_see_person(person_id))
--   CHECK ((mentor_id = acting_account()) AND can_see_person(person_id))
-- policy assessment_responses.ar_student_read [SELECT]
--   USING ((person_id IN ( SELECT my_person_ids() AS my_person_ids)) AND aluno_pode('resultados'::text))
--   CHECK -
-- policy biblioteca_materiais.bib_read [SELECT]
--   USING ((mentor_id = acting_account()) OR ((mentor_id IN ( SELECT p.mentor_id
   FROM people p
  WHERE (p.user_id = auth.uid()))) AND aluno_pode('academy'::text) AND bib_material_liberado(id)))
--   CHECK -
-- policy biblioteca_materiais.bib_write [ALL]
--   USING (mentor_id = auth.uid())
--   CHECK (mentor_id = auth.uid())
-- policy biblioteca_material_destinos.bmd_rw [ALL]
--   USING (EXISTS ( SELECT 1
   FROM biblioteca_materiais m
  WHERE ((m.id = biblioteca_material_destinos.material_id) AND (m.mentor_id = auth.uid()))))
--   CHECK (EXISTS ( SELECT 1
   FROM biblioteca_materiais m
  WHERE ((m.id = biblioteca_material_destinos.material_id) AND (m.mentor_id = auth.uid()))))
-- policy biblioteca_pasta_destinos.bpd_rw [ALL]
--   USING (EXISTS ( SELECT 1
   FROM biblioteca_pastas p
  WHERE ((p.id = biblioteca_pasta_destinos.pasta_id) AND (p.mentor_id = auth.uid()))))
--   CHECK (EXISTS ( SELECT 1
   FROM biblioteca_pastas p
  WHERE ((p.id = biblioteca_pasta_destinos.pasta_id) AND (p.mentor_id = auth.uid()))))
-- policy biblioteca_pastas.bibp_read [SELECT]
--   USING ((mentor_id = acting_account()) OR ((mentor_id IN ( SELECT p.mentor_id
   FROM people p
  WHERE (p.user_id = auth.uid()))) AND aluno_pode('academy'::text)))
--   CHECK -
-- policy biblioteca_pastas.bibp_write [ALL]
--   USING (mentor_id = auth.uid())
--   CHECK (mentor_id = auth.uid())
-- policy community_comments.cc_delete [DELETE]
--   USING ((author_id = auth.uid()) OR posso_moderar_post(post_id))
--   CHECK -
-- policy community_comments.cc_insert [INSERT]
--   USING -
--   CHECK ((author_id = auth.uid()) AND posso_ver_post(post_id))
-- policy community_comments.cc_read [SELECT]
--   USING posso_ver_post(post_id)
--   CHECK -
-- policy community_post_groups.cpg_delete [DELETE]
--   USING sou_autor_do_post(post_id)
--   CHECK -
-- policy community_post_groups.cpg_insert [INSERT]
--   USING -
--   CHECK (posso_ver_grupo(group_id) AND sou_autor_do_post(post_id) AND aluno_pode('comunidade'::text))
-- policy community_post_groups.cpg_read [SELECT]
--   USING posso_ver_grupo(group_id)
--   CHECK -
-- policy community_posts.cp_delete [DELETE]
--   USING ((author_id = auth.uid()) OR posso_moderar_post(id))
--   CHECK -
-- policy community_posts.cp_insert [INSERT]
--   USING -
--   CHECK ((author_id = auth.uid()) AND aluno_pode('comunidade'::text))
-- policy community_posts.cp_read [SELECT]
--   USING (aluno_pode('comunidade'::text) AND (EXISTS ( SELECT 1
   FROM community_post_groups g
  WHERE ((g.post_id = community_posts.id) AND posso_ver_grupo(g.group_id)))))
--   CHECK -
-- policy community_posts.cp_update [UPDATE]
--   USING (author_id = auth.uid())
--   CHECK (author_id = auth.uid())
-- policy community_reactions.cr_delete [DELETE]
--   USING (user_id = auth.uid())
--   CHECK -
-- policy community_reactions.cr_insert [INSERT]
--   USING -
--   CHECK ((user_id = auth.uid()) AND posso_ver_post(post_id))
-- policy community_reactions.cr_read [SELECT]
--   USING posso_ver_post(post_id)
--   CHECK -
-- policy devolutivas.devolutivas_delete [DELETE]
--   USING ((mentor_id = acting_account()) AND can_see_person(person_id))
--   CHECK -
-- policy devolutivas.devolutivas_insert [INSERT]
--   USING -
--   CHECK ((mentor_id = acting_account()) AND can_see_person(person_id) AND posso_agendar_devolutiva(person_id))
-- policy devolutivas.devolutivas_read [SELECT]
--   USING ((mentor_id = acting_account()) AND can_see_person(person_id))
--   CHECK -
-- policy devolutivas.devolutivas_read_aluno [SELECT]
--   USING ((person_id IN ( SELECT my_person_ids() AS my_person_ids)) AND aluno_pode('devolutivas'::text))
--   CHECK -
-- policy devolutivas.devolutivas_update [UPDATE]
--   USING ((mentor_id = acting_account()) AND can_see_person(person_id) AND posso_agendar_devolutiva(person_id))
--   CHECK (mentor_id = acting_account())
-- policy email_logs.email_logs_read [SELECT]
--   USING (mentor_id = acting_account())
--   CHECK -
-- policy evento_destinos.ed_read [SELECT]
--   USING posso_ver_evento(evento_id)
--   CHECK -
-- policy evento_destinos.ed_write [ALL]
--   USING (EXISTS ( SELECT 1
   FROM eventos e
  WHERE ((e.id = evento_destinos.evento_id) AND (e.conta_id = auth.uid()))))
--   CHECK (EXISTS ( SELECT 1
   FROM eventos e
  WHERE ((e.id = evento_destinos.evento_id) AND (e.conta_id = auth.uid()))))
-- policy eventos.eventos_read [SELECT]
--   USING posso_ver_evento(id)
--   CHECK -
-- policy eventos.eventos_write [ALL]
--   USING (conta_id = auth.uid())
--   CHECK (conta_id = auth.uid())
-- policy google_conexoes.gc_delete [DELETE]
--   USING (user_id = auth.uid())
--   CHECK -
-- policy group_instruments.Mentors add instruments to their groups [INSERT]
--   USING -
--   CHECK ((group_id IN ( SELECT visible_group_ids() AS visible_group_ids)) AND (member_kind() <> 'mentor'::text))
-- policy group_instruments.Mentors remove instruments from their groups [DELETE]
--   USING ((group_id IN ( SELECT visible_group_ids() AS visible_group_ids)) AND (member_kind() <> 'mentor'::text))
--   CHECK -
-- policy group_instruments.Mentors view instruments of their groups [SELECT]
--   USING (group_id IN ( SELECT visible_group_ids() AS visible_group_ids))
--   CHECK -
-- policy group_members.Mentors add members to their groups [INSERT]
--   USING -
--   CHECK ((group_id IN ( SELECT visible_group_ids() AS visible_group_ids)) AND (member_kind() <> 'mentor'::text))
-- policy group_members.Mentors remove members from their groups [DELETE]
--   USING ((group_id IN ( SELECT visible_group_ids() AS visible_group_ids)) AND (member_kind() <> 'mentor'::text))
--   CHECK -
-- policy group_members.grupo_membros_read [SELECT]
--   USING posso_ver_grupo(group_id)
--   CHECK -
-- policy groups.Mentors delete their own groups [DELETE]
--   USING ((mentor_id = acting_account()) AND (member_kind() <> 'mentor'::text))
--   CHECK -
-- policy groups.Mentors insert their own groups [INSERT]
--   USING -
--   CHECK ((mentor_id = acting_account()) AND (member_kind() <> 'mentor'::text))
-- policy groups.Mentors update their own groups [UPDATE]
--   USING ((mentor_id = acting_account()) AND (member_kind() <> 'mentor'::text))
--   CHECK (mentor_id = acting_account())
-- policy groups.grupos_read [SELECT]
--   USING posso_ver_grupo(id)
--   CHECK -
-- policy instruments.Instruments are readable by everyone [SELECT]
--   USING true
--   CHECK -
-- policy invite_links.il_all_own [ALL]
--   USING (mentor_id = acting_account())
--   CHECK (mentor_id = acting_account())
-- policy learning_lessons.ll_read [SELECT]
--   USING (can_see_track(track_id) AND track_liberada(track_id))
--   CHECK -
-- policy learning_lessons.ll_write [ALL]
--   USING can_edit_track(track_id)
--   CHECK can_edit_track(track_id)
-- policy learning_materials.lmat_read [SELECT]
--   USING (can_see_track(track_id) AND track_liberada(track_id))
--   CHECK -
-- policy learning_materials.lmat_write [ALL]
--   USING can_edit_track(track_id)
--   CHECK can_edit_track(track_id)
-- policy learning_modules.lm_read [SELECT]
--   USING (can_see_track(track_id) AND track_liberada(track_id))
--   CHECK -
-- policy learning_modules.lm_write [ALL]
--   USING can_edit_track(track_id)
--   CHECK can_edit_track(track_id)
-- policy learning_progress.lp_own [ALL]
--   USING (user_id = auth.uid())
--   CHECK ((user_id = auth.uid()) AND track_liberada(track_id))
-- policy learning_progress.lp_owner_read [SELECT]
--   USING can_edit_track(track_id)
--   CHECK -
-- policy learning_track_destinos.ltd_read [SELECT]
--   USING can_edit_track(track_id)
--   CHECK -
-- policy learning_track_destinos.ltd_write [ALL]
--   USING can_edit_track(track_id)
--   CHECK can_edit_track(track_id)
-- policy learning_tracks.lt_delete [DELETE]
--   USING can_edit_track(id)
--   CHECK -
-- policy learning_tracks.lt_insert [INSERT]
--   USING -
--   CHECK ((owner_id = acting_account()) AND (member_kind() <> 'mentor'::text))
-- policy learning_tracks.lt_read [SELECT]
--   USING ((owner_id = acting_account()) OR (is_published AND (audience = ANY (ARRAY['alunos'::text, 'ambos'::text])) AND (owner_id IN ( SELECT p.mentor_id
   FROM people p
  WHERE (p.user_id = auth.uid())))))
--   CHECK -
-- policy learning_tracks.lt_update [UPDATE]
--   USING can_edit_track(id)
--   CHECK (owner_id = acting_account())
-- policy mentors.mentors_owner_all [ALL]
--   USING (owner_id = auth.uid())
--   CHECK (owner_id = auth.uid())
-- policy notificacoes.notif_delete [DELETE]
--   USING (user_id = auth.uid())
--   CHECK -
-- policy notificacoes.notif_read [SELECT]
--   USING (user_id = auth.uid())
--   CHECK -
-- policy notificacoes.notif_update [UPDATE]
--   USING (user_id = auth.uid())
--   CHECK (user_id = auth.uid())
-- policy option_scores.os_read [SELECT]
--   USING (test_version_is_template(option_version_id(option_id)) OR owns_test_version(option_version_id(option_id)))
--   CHECK -
-- policy option_scores.os_write [ALL]
--   USING owns_test_version(option_version_id(option_id))
--   CHECK owns_test_version(option_version_id(option_id))
-- policy people.Mentors delete their own people [DELETE]
--   USING ((mentor_id = acting_account()) AND (member_kind() <> 'mentor'::text))
--   CHECK -
-- policy people.Mentors insert their own people [INSERT]
--   USING -
--   CHECK (mentor_id = acting_account())
-- policy people.Mentors update their own people [UPDATE]
--   USING ((mentor_id = acting_account()) AND can_see_person(id))
--   CHECK (mentor_id = acting_account())
-- policy people.Mentors view their own people [SELECT]
--   USING ((mentor_id = acting_account()) AND can_see_person(id))
--   CHECK -
-- policy people.people_self_read [SELECT]
--   USING (user_id = auth.uid())
--   CHECK -
-- policy pontos.pontos_insert [INSERT]
--   USING -
--   CHECK (user_id = auth.uid())
-- policy pontos.pontos_read [SELECT]
--   USING ((user_id = auth.uid()) OR (mentor_id = acting_account()) OR (aluno_pode('comunidade'::text) AND (EXISTS ( SELECT 1
   FROM (group_members gm
     JOIN people p ON ((p.id = gm.person_id)))
  WHERE ((p.user_id = pontos.user_id) AND (gm.group_id IN ( SELECT meus_grupos_como_avaliado() AS meus_grupos_como_avaliado)))))))
--   CHECK -
-- policy profiles.profiles_equipe_read [SELECT]
--   USING ((user_id = auth.uid()) OR (user_id IN ( SELECT tm.user_id
   FROM team_members tm
  WHERE ((tm.owner_id = auth.uid()) AND (tm.user_id IS NOT NULL)))) OR (user_id IN ( SELECT tm.owner_id
   FROM team_members tm
  WHERE ((tm.user_id = auth.uid()) AND (tm.status = 'ativo'::text)))))
--   CHECK -
-- policy profiles.profiles_owner_all [ALL]
--   USING (user_id = auth.uid())
--   CHECK (user_id = auth.uid())
-- policy report_content.rc_read [SELECT]
--   USING ((version_id IS NULL) OR owns_test_version(version_id))
--   CHECK -
-- policy report_content.rc_write [ALL]
--   USING ((version_id IS NOT NULL) AND owns_test_version(version_id))
--   CHECK ((version_id IS NOT NULL) AND owns_test_version(version_id))
-- policy team_member_groups.tmg_owner_all [ALL]
--   USING (EXISTS ( SELECT 1
   FROM team_members tm
  WHERE ((tm.id = team_member_groups.team_member_id) AND (tm.owner_id = auth.uid()))))
--   CHECK (EXISTS ( SELECT 1
   FROM team_members tm
  WHERE ((tm.id = team_member_groups.team_member_id) AND (tm.owner_id = auth.uid()))))
-- policy team_member_groups.tmg_self_read [SELECT]
--   USING (EXISTS ( SELECT 1
   FROM team_members tm
  WHERE ((tm.id = team_member_groups.team_member_id) AND (tm.user_id = auth.uid()))))
--   CHECK -
-- policy team_members.tm_owner_all [ALL]
--   USING (owner_id = auth.uid())
--   CHECK (owner_id = auth.uid())
-- policy team_members.tm_self_read [SELECT]
--   USING (user_id = auth.uid())
--   CHECK -
-- policy test_answers.ta_mentor [ALL]
--   USING (response_mentor_id(response_id) = acting_account())
--   CHECK (response_mentor_id(response_id) = acting_account())
-- policy test_dimensions.td_read [SELECT]
--   USING (test_version_is_template(version_id) OR owns_test_version(version_id))
--   CHECK -
-- policy test_dimensions.td_write [ALL]
--   USING owns_test_version(version_id)
--   CHECK owns_test_version(version_id)
-- policy test_options.to_read [SELECT]
--   USING (test_version_is_template(question_version_id(question_id)) OR owns_test_version(question_version_id(question_id)))
--   CHECK -
-- policy test_options.to_write [ALL]
--   USING owns_test_version(question_version_id(question_id))
--   CHECK owns_test_version(question_version_id(question_id))
-- policy test_questions.tq_read [SELECT]
--   USING (test_version_is_template(version_id) OR owns_test_version(version_id))
--   CHECK -
-- policy test_questions.tq_write [ALL]
--   USING owns_test_version(version_id)
--   CHECK owns_test_version(version_id)
-- policy test_responses.tr_mentor_all [ALL]
--   USING ((mentor_id = acting_account()) AND can_see_person(person_id))
--   CHECK ((mentor_id = acting_account()) AND can_see_person(person_id))
-- policy test_responses.tr_student_read [SELECT]
--   USING ((person_id IN ( SELECT my_person_ids() AS my_person_ids)) AND aluno_pode('resultados'::text))
--   CHECK -
-- policy test_result_bands.trb_read [SELECT]
--   USING (test_version_is_template(version_id) OR owns_test_version(version_id))
--   CHECK -
-- policy test_result_bands.trb_write [ALL]
--   USING owns_test_version(version_id)
--   CHECK owns_test_version(version_id)
-- policy test_versions.tv_delete_own [DELETE]
--   USING ((mentor_id = acting_account()) AND (member_kind() <> 'mentor'::text))
--   CHECK -
-- policy test_versions.tv_insert_own [INSERT]
--   USING -
--   CHECK ((mentor_id = acting_account()) AND (is_template = false) AND (member_kind() <> 'mentor'::text))
-- policy test_versions.tv_read_templates [SELECT]
--   USING ((is_template = true) OR (mentor_id = acting_account()))
--   CHECK -
-- policy test_versions.tv_update_own [UPDATE]
--   USING ((mentor_id = acting_account()) AND (member_kind() <> 'mentor'::text))
--   CHECK (mentor_id = acting_account())
-- policy treinamento_anotacoes.anot_rw [ALL]
--   USING posso_dar_aula(aula_id)
--   CHECK posso_dar_aula(aula_id)
-- policy treinamento_aulas.aula_read [SELECT]
--   USING (EXISTS ( SELECT 1
   FROM treinamento_modulos m
  WHERE ((m.id = treinamento_aulas.modulo_id) AND posso_ver_treinamento(m.treinamento_id))))
--   CHECK -
-- policy treinamento_aulas.aula_write [ALL]
--   USING (EXISTS ( SELECT 1
   FROM (treinamento_modulos m
     JOIN treinamentos t ON ((t.id = m.treinamento_id)))
  WHERE ((m.id = treinamento_aulas.modulo_id) AND (t.mentor_id = auth.uid()))))
--   CHECK (EXISTS ( SELECT 1
   FROM (treinamento_modulos m
     JOIN treinamentos t ON ((t.id = m.treinamento_id)))
  WHERE ((m.id = treinamento_aulas.modulo_id) AND (t.mentor_id = auth.uid()))))
-- policy treinamento_grupos.tg_read [SELECT]
--   USING posso_ver_treinamento(treinamento_id)
--   CHECK -
-- policy treinamento_grupos.tg_write [ALL]
--   USING (EXISTS ( SELECT 1
   FROM treinamentos t
  WHERE ((t.id = treinamento_grupos.treinamento_id) AND (t.mentor_id = auth.uid()))))
--   CHECK (EXISTS ( SELECT 1
   FROM treinamentos t
  WHERE ((t.id = treinamento_grupos.treinamento_id) AND (t.mentor_id = auth.uid()))))
-- policy treinamento_materiais.mat_read [SELECT]
--   USING (posso_dar_aula(aula_id) OR (visivel_aluno AND (EXISTS ( SELECT 1
   FROM (treinamento_aulas a
     JOIN treinamento_modulos m ON ((m.id = a.modulo_id)))
  WHERE ((a.id = treinamento_materiais.aula_id) AND posso_ver_treinamento(m.treinamento_id))))))
--   CHECK -
-- policy treinamento_materiais.mat_write [ALL]
--   USING (EXISTS ( SELECT 1
   FROM ((treinamento_aulas a
     JOIN treinamento_modulos m ON ((m.id = a.modulo_id)))
     JOIN treinamentos t ON ((t.id = m.treinamento_id)))
  WHERE ((a.id = treinamento_materiais.aula_id) AND (t.mentor_id = auth.uid()))))
--   CHECK (EXISTS ( SELECT 1
   FROM ((treinamento_aulas a
     JOIN treinamento_modulos m ON ((m.id = a.modulo_id)))
     JOIN treinamentos t ON ((t.id = m.treinamento_id)))
  WHERE ((a.id = treinamento_materiais.aula_id) AND (t.mentor_id = auth.uid()))))
-- policy treinamento_modulos.mod_read [SELECT]
--   USING posso_ver_treinamento(treinamento_id)
--   CHECK -
-- policy treinamento_modulos.mod_write [ALL]
--   USING (EXISTS ( SELECT 1
   FROM treinamentos t
  WHERE ((t.id = treinamento_modulos.treinamento_id) AND (t.mentor_id = auth.uid()))))
--   CHECK (EXISTS ( SELECT 1
   FROM treinamentos t
  WHERE ((t.id = treinamento_modulos.treinamento_id) AND (t.mentor_id = auth.uid()))))
-- policy treinamento_presencas.pres_minha [SELECT]
--   USING (EXISTS ( SELECT 1
   FROM people p
  WHERE ((p.id = treinamento_presencas.person_id) AND (p.user_id = auth.uid()))))
--   CHECK -
-- policy treinamento_presencas.pres_professor [ALL]
--   USING posso_dar_aula(aula_id)
--   CHECK posso_dar_aula(aula_id)
-- policy treinamentos.trein_read [SELECT]
--   USING posso_ver_treinamento(id)
--   CHECK -
-- policy treinamentos.trein_write [ALL]
--   USING (mentor_id = auth.uid())
--   CHECK (mentor_id = auth.uid())

-- ===================== INDICES =====================
CREATE UNIQUE INDEX academy_banners_pkey ON public.academy_banners USING btree (id);
CREATE UNIQUE INDEX action_plans_pkey ON public.action_plans USING btree (id);
CREATE UNIQUE INDEX action_plans_response_id_key ON public.action_plans USING btree (response_id);
CREATE UNIQUE INDEX assessment_responses_pkey ON public.assessment_responses USING btree (id);
CREATE INDEX banners_conta_idx ON public.academy_banners USING btree (mentor_id, ordem);
CREATE INDEX bib_material_pasta_idx ON public.biblioteca_materiais USING btree (pasta_id);
CREATE INDEX bib_pasta_conta_idx ON public.biblioteca_pastas USING btree (mentor_id, ordem, created_at);
CREATE INDEX biblioteca_conta_idx ON public.biblioteca_materiais USING btree (mentor_id, created_at DESC);
CREATE UNIQUE INDEX biblioteca_materiais_pkey ON public.biblioteca_materiais USING btree (id);
CREATE UNIQUE INDEX biblioteca_material_destinos_pkey ON public.biblioteca_material_destinos USING btree (id);
CREATE UNIQUE INDEX biblioteca_pasta_destinos_pkey ON public.biblioteca_pasta_destinos USING btree (id);
CREATE UNIQUE INDEX biblioteca_pastas_pkey ON public.biblioteca_pastas USING btree (id);
CREATE UNIQUE INDEX bmd_grupo_uk ON public.biblioteca_material_destinos USING btree (material_id, group_id) WHERE (group_id IS NOT NULL);
CREATE UNIQUE INDEX bmd_pessoa_uk ON public.biblioteca_material_destinos USING btree (material_id, person_id) WHERE (person_id IS NOT NULL);
CREATE UNIQUE INDEX bpd_grupo_uk ON public.biblioteca_pasta_destinos USING btree (pasta_id, group_id) WHERE (group_id IS NOT NULL);
CREATE UNIQUE INDEX bpd_pessoa_uk ON public.biblioteca_pasta_destinos USING btree (pasta_id, person_id) WHERE (person_id IS NOT NULL);
CREATE UNIQUE INDEX community_comments_pkey ON public.community_comments USING btree (id);
CREATE INDEX community_comments_post_idx ON public.community_comments USING btree (post_id, created_at);
CREATE UNIQUE INDEX community_post_groups_pkey ON public.community_post_groups USING btree (post_id, group_id);
CREATE UNIQUE INDEX community_posts_pkey ON public.community_posts USING btree (id);
CREATE UNIQUE INDEX community_reactions_pkey ON public.community_reactions USING btree (post_id, user_id);
CREATE INDEX cpg_group_idx ON public.community_post_groups USING btree (group_id);
CREATE UNIQUE INDEX devolutivas_bateria_unica ON public.devolutivas USING btree (assessment_id) WHERE ((assessment_id IS NOT NULL) AND (status <> 'cancelada'::text));
CREATE INDEX devolutivas_mentor_idx ON public.devolutivas USING btree (mentor_id, status);
CREATE INDEX devolutivas_person_idx ON public.devolutivas USING btree (person_id);
CREATE UNIQUE INDEX devolutivas_pkey ON public.devolutivas USING btree (id);
CREATE UNIQUE INDEX devolutivas_resposta_unica ON public.devolutivas USING btree (response_id) WHERE ((response_id IS NOT NULL) AND (status <> 'cancelada'::text));
CREATE UNIQUE INDEX email_logs_pkey ON public.email_logs USING btree (id);
CREATE UNIQUE INDEX evento_destino_grupo_uk ON public.evento_destinos USING btree (evento_id, group_id) WHERE (group_id IS NOT NULL);
CREATE UNIQUE INDEX evento_destino_pessoa_uk ON public.evento_destinos USING btree (evento_id, person_id) WHERE (person_id IS NOT NULL);
CREATE UNIQUE INDEX evento_destinos_pkey ON public.evento_destinos USING btree (id);
CREATE UNIQUE INDEX eventos_aula_uk ON public.eventos USING btree (aula_id) WHERE (aula_id IS NOT NULL);
CREATE INDEX eventos_conta_quando_idx ON public.eventos USING btree (conta_id, quando);
CREATE UNIQUE INDEX eventos_pkey ON public.eventos USING btree (id);
CREATE UNIQUE INDEX google_conexoes_pkey ON public.google_conexoes USING btree (user_id);
CREATE UNIQUE INDEX google_eventos_origem_uk ON public.google_eventos USING btree (user_id, origem, origem_id);
CREATE UNIQUE INDEX google_eventos_pkey ON public.google_eventos USING btree (id);
CREATE INDEX group_instruments_instrument_idx ON public.group_instruments USING btree (instrument_id);
CREATE UNIQUE INDEX group_instruments_pkey ON public.group_instruments USING btree (group_id, instrument_id);
CREATE INDEX group_members_person_idx ON public.group_members USING btree (person_id);
CREATE UNIQUE INDEX group_members_pkey ON public.group_members USING btree (group_id, person_id);
CREATE INDEX groups_mentor_idx ON public.groups USING btree (mentor_id);
CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id);
CREATE INDEX idx_assessment_responses_mentor ON public.assessment_responses USING btree (mentor_id);
CREATE INDEX idx_assessment_responses_person ON public.assessment_responses USING btree (person_id);
CREATE INDEX idx_email_logs_assessment ON public.email_logs USING btree (assessment_id);
CREATE INDEX idx_email_logs_mentor ON public.email_logs USING btree (mentor_id, created_at DESC);
CREATE INDEX idx_email_logs_response ON public.email_logs USING btree (response_id);
CREATE INDEX idx_invite_links_mentor ON public.invite_links USING btree (mentor_id);
CREATE INDEX idx_ll_module ON public.learning_lessons USING btree (module_id, sort_order);
CREATE INDEX idx_lm_track ON public.learning_modules USING btree (track_id, sort_order);
CREATE INDEX idx_lmat_lesson ON public.learning_materials USING btree (lesson_id, sort_order);
CREATE INDEX idx_lp_user ON public.learning_progress USING btree (user_id, track_id);
CREATE INDEX idx_people_user ON public.people USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX idx_report_content_lookup ON public.report_content USING btree (section, dimension_key, mode);
CREATE INDEX idx_team_members_user_ativo ON public.team_members USING btree (user_id) WHERE (status = 'ativo'::text);
CREATE INDEX idx_test_responses_assessment ON public.test_responses USING btree (assessment_response_id);
CREATE INDEX idx_test_responses_parent ON public.test_responses USING btree (parent_response_id);
CREATE INDEX idx_test_responses_person_version ON public.test_responses USING btree (person_id, version_id);
CREATE INDEX idx_test_responses_previous ON public.test_responses USING btree (previous_response_id);
CREATE UNIQUE INDEX instruments_pkey ON public.instruments USING btree (id);
CREATE UNIQUE INDEX invite_links_pkey ON public.invite_links USING btree (id);
CREATE UNIQUE INDEX learning_lessons_pkey ON public.learning_lessons USING btree (id);
CREATE UNIQUE INDEX learning_materials_pkey ON public.learning_materials USING btree (id);
CREATE UNIQUE INDEX learning_modules_pkey ON public.learning_modules USING btree (id);
CREATE UNIQUE INDEX learning_progress_pkey ON public.learning_progress USING btree (id);
CREATE UNIQUE INDEX learning_track_destinos_pkey ON public.learning_track_destinos USING btree (id);
CREATE UNIQUE INDEX learning_tracks_pkey ON public.learning_tracks USING btree (id);
CREATE UNIQUE INDEX ltd_grupo_uk ON public.learning_track_destinos USING btree (track_id, group_id) WHERE (group_id IS NOT NULL);
CREATE UNIQUE INDEX ltd_pessoa_uk ON public.learning_track_destinos USING btree (track_id, person_id) WHERE (person_id IS NOT NULL);
CREATE INDEX ltd_track_idx ON public.learning_track_destinos USING btree (track_id);
CREATE UNIQUE INDEX mentors_pkey ON public.mentors USING btree (id);
CREATE INDEX notif_minhas_idx ON public.notificacoes USING btree (user_id, created_at DESC);
CREATE INDEX notif_nao_lidas_idx ON public.notificacoes USING btree (user_id) WHERE (lida_em IS NULL);
CREATE UNIQUE INDEX notif_vespera_unica ON public.notificacoes USING btree (user_id, tipo, link) WHERE (tipo = ANY (ARRAY['vespera_aula'::text, 'vespera_devolutiva'::text]));
CREATE UNIQUE INDEX notificacoes_pkey ON public.notificacoes USING btree (id);
CREATE INDEX option_scores_dimension_id_idx ON public.option_scores USING btree (dimension_id);
CREATE UNIQUE INDEX option_scores_option_id_dimension_id_key ON public.option_scores USING btree (option_id, dimension_id);
CREATE INDEX option_scores_option_id_idx ON public.option_scores USING btree (option_id);
CREATE UNIQUE INDEX option_scores_pkey ON public.option_scores USING btree (id);
CREATE UNIQUE INDEX people_email_unico_por_conta ON public.people USING btree (mentor_id, lower(email)) WHERE ((email IS NOT NULL) AND (email <> ''::text));
CREATE INDEX people_mentor_idx ON public.people USING btree (mentor_id);
CREATE UNIQUE INDEX people_pkey ON public.people USING btree (id);
CREATE INDEX pontos_conta_idx ON public.pontos USING btree (mentor_id, user_id);
CREATE INDEX pontos_dia_idx ON public.pontos USING btree (user_id, acao, created_at);
CREATE UNIQUE INDEX pontos_pkey ON public.pontos USING btree (id);
CREATE UNIQUE INDEX pontos_sem_repeticao ON public.pontos USING btree (user_id, acao, referencia) WHERE (referencia IS NOT NULL);
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (user_id);
CREATE INDEX rc_busca_idx ON public.report_content USING btree (section, dimension_key, mode, sort_order);
CREATE INDEX rc_versao_idx ON public.report_content USING btree (version_id) WHERE (version_id IS NOT NULL);
CREATE UNIQUE INDEX report_content_pkey ON public.report_content USING btree (id);
CREATE UNIQUE INDEX team_member_groups_pkey ON public.team_member_groups USING btree (team_member_id, group_id);
CREATE INDEX team_members_person_idx ON public.team_members USING btree (person_id);
CREATE UNIQUE INDEX team_members_pessoa_unica ON public.team_members USING btree (person_id) WHERE (person_id IS NOT NULL);
CREATE UNIQUE INDEX team_members_pkey ON public.team_members USING btree (id);
CREATE UNIQUE INDEX test_answers_pkey ON public.test_answers USING btree (id);
CREATE INDEX test_answers_response_id_idx ON public.test_answers USING btree (response_id);
CREATE UNIQUE INDEX test_answers_response_id_question_id_key ON public.test_answers USING btree (response_id, question_id);
CREATE UNIQUE INDEX test_dimensions_pkey ON public.test_dimensions USING btree (id);
CREATE INDEX test_dimensions_version_id_idx ON public.test_dimensions USING btree (version_id);
CREATE UNIQUE INDEX test_dimensions_version_id_key_key ON public.test_dimensions USING btree (version_id, key);
CREATE UNIQUE INDEX test_options_pkey ON public.test_options USING btree (id);
CREATE INDEX test_options_question_id_idx ON public.test_options USING btree (question_id);
CREATE UNIQUE INDEX test_questions_pkey ON public.test_questions USING btree (id);
CREATE INDEX test_questions_version_id_idx ON public.test_questions USING btree (version_id);
CREATE INDEX test_responses_mentor_id_idx ON public.test_responses USING btree (mentor_id);
CREATE INDEX test_responses_person_id_idx ON public.test_responses USING btree (person_id);
CREATE UNIQUE INDEX test_responses_pkey ON public.test_responses USING btree (id);
CREATE INDEX test_responses_version_id_idx ON public.test_responses USING btree (version_id);
CREATE UNIQUE INDEX test_result_bands_pkey ON public.test_result_bands USING btree (id);
CREATE INDEX test_result_bands_version_id_idx ON public.test_result_bands USING btree (version_id);
CREATE INDEX test_versions_instrument_id_idx ON public.test_versions USING btree (instrument_id);
CREATE INDEX test_versions_mentor_id_idx ON public.test_versions USING btree (mentor_id);
CREATE UNIQUE INDEX test_versions_pkey ON public.test_versions USING btree (id);
CREATE INDEX trein_aula_idx ON public.treinamento_aulas USING btree (modulo_id, ordem);
CREATE INDEX trein_conta_idx ON public.treinamentos USING btree (mentor_id, created_at DESC);
CREATE INDEX trein_mat_idx ON public.treinamento_materiais USING btree (aula_id, ordem);
CREATE INDEX trein_mod_idx ON public.treinamento_modulos USING btree (treinamento_id, ordem);
CREATE INDEX trein_pres_aula_idx ON public.treinamento_presencas USING btree (aula_id, registrado_em);
CREATE INDEX trein_pres_pessoa_idx ON public.treinamento_presencas USING btree (person_id);
CREATE UNIQUE INDEX treinamento_anotacoes_pkey ON public.treinamento_anotacoes USING btree (aula_id);
CREATE UNIQUE INDEX treinamento_aulas_pkey ON public.treinamento_aulas USING btree (id);
CREATE UNIQUE INDEX treinamento_grupos_pkey ON public.treinamento_grupos USING btree (treinamento_id, group_id);
CREATE UNIQUE INDEX treinamento_materiais_pkey ON public.treinamento_materiais USING btree (id);
CREATE UNIQUE INDEX treinamento_modulos_pkey ON public.treinamento_modulos USING btree (id);
CREATE UNIQUE INDEX treinamento_presencas_aula_id_person_id_key ON public.treinamento_presencas USING btree (aula_id, person_id);
CREATE UNIQUE INDEX treinamento_presencas_passe_nonce_key ON public.treinamento_presencas USING btree (passe_nonce);
CREATE UNIQUE INDEX treinamento_presencas_pkey ON public.treinamento_presencas USING btree (id);
CREATE UNIQUE INDEX treinamentos_pkey ON public.treinamentos USING btree (id);
CREATE UNIQUE INDEX uq_learning_progress ON public.learning_progress USING btree (lesson_id, user_id);
CREATE UNIQUE INDEX uq_team_members_owner_email ON public.team_members USING btree (owner_id, lower(email));
CREATE UNIQUE INDEX uq_team_members_token ON public.team_members USING btree (invite_token);

-- ===================== FUNCOES =====================
CREATE OR REPLACE FUNCTION public.accept_team_invite(_token uuid)
 RETURNS TABLE(id uuid, kind text, owner_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_row public.team_members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado para aceitar o convite.';
  END IF;

  SELECT tm.* INTO v_row FROM public.team_members tm WHERE tm.invite_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;
  IF v_row.invite_expires_at IS NOT NULL AND v_row.invite_expires_at < now() THEN
    RAISE EXCEPTION 'Este convite expirou. Peça um novo.';
  END IF;
  IF v_row.status = 'inativo' THEN
    RAISE EXCEPTION 'Este convite foi desativado.';
  END IF;
  -- Já aceito por outra pessoa: não deixa trocar o dono do vínculo.
  IF v_row.user_id IS NOT NULL AND v_row.user_id <> v_uid THEN
    RAISE EXCEPTION 'Este convite já foi usado.';
  END IF;

  -- O convite é nominal: vale para o email convidado, não para quem receber o link.
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF lower(COALESCE(v_email, '')) <> lower(v_row.email) THEN
    RAISE EXCEPTION 'Este convite foi enviado para %. Entre com esse email para aceitar.', v_row.email;
  END IF;

  UPDATE public.team_members tm
     SET user_id = v_uid, status = 'ativo', accepted_at = COALESCE(tm.accepted_at, now())
   WHERE tm.id = v_row.id;

  RETURN QUERY SELECT v_row.id, v_row.kind, v_row.owner_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.acting_account()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT tm.owner_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'ativo'
      ORDER BY tm.created_at LIMIT 1),
    auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.aluno_pode(p_area text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Nao tem cadastro de avaliado: e o dono da conta.
    NOT EXISTS (SELECT 1 FROM public.people p WHERE p.user_id = auth.uid())
    -- Ou e da equipe (colaborador, ou avaliado promovido a mentor).
    OR EXISTS (SELECT 1 FROM public.team_members tm
                WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
    -- Aluno sem grupo nenhum: nao ha grupo para restringir, vale o padrao.
    OR NOT EXISTS (
         SELECT 1 FROM public.group_members gm
           JOIN public.people p ON p.id = gm.person_id
          WHERE p.user_id = auth.uid())
    -- Uniao: basta UM grupo dele liberar a area.
    OR EXISTS (
         SELECT 1 FROM public.group_members gm
           JOIN public.groups g ON g.id = gm.group_id
           JOIN public.people p ON p.id = gm.person_id
          WHERE p.user_id = auth.uid()
            AND (g.areas_aluno IS NULL OR p_area = ANY (g.areas_aluno)));
$function$
;

CREATE OR REPLACE FUNCTION public.areas_da_pessoa(p_person_id uuid)
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a FROM unnest(ARRAY['resultados','comunidade','devolutivas','agenda','academy','classroom']) a
   WHERE EXISTS (SELECT 1 FROM public.people p
                  WHERE p.id = p_person_id AND p.mentor_id = public.acting_account())
     AND (
       NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.person_id = p_person_id)
       OR EXISTS (SELECT 1 FROM public.group_members gm
                    JOIN public.groups g ON g.id = gm.group_id
                   WHERE gm.person_id = p_person_id
                     AND (g.areas_aluno IS NULL OR a = ANY (g.areas_aluno)))
     );
$function$
;

CREATE OR REPLACE FUNCTION public.avisos_da_vespera()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.bib_materiais_liberados(_person_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.id FROM public.biblioteca_materiais m
   WHERE CASE
           WHEN _person_id IS NULL THEN public.bib_material_liberado(m.id)
           WHEN EXISTS (SELECT 1 FROM public.people pe
                         WHERE pe.id = _person_id
                           AND pe.mentor_id = public.acting_account())
             THEN public.bib_material_liberado_para(m.id, _person_id)
           ELSE false
         END;
$function$
;

CREATE OR REPLACE FUNCTION public.bib_material_liberado(_material_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.biblioteca_materiais m
             WHERE m.id = _material_id AND m.mentor_id = public.acting_account())
    OR (
      public.bib_pasta_liberada(
        (SELECT m.pasta_id FROM public.biblioteca_materiais m WHERE m.id = _material_id))
      AND (
        NOT EXISTS (SELECT 1 FROM public.biblioteca_material_destinos d
                     WHERE d.material_id = _material_id)
        OR EXISTS (
             SELECT 1 FROM public.biblioteca_material_destinos d
              WHERE d.material_id = _material_id
                AND (
                  d.person_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
                  OR d.group_id IN (
                       SELECT gm.group_id FROM public.group_members gm
                         JOIN public.people p ON p.id = gm.person_id
                        WHERE p.user_id = auth.uid())
                  OR d.group_id IN (
                       SELECT tmg.group_id FROM public.team_member_groups tmg
                         JOIN public.team_members tm ON tm.id = tmg.team_member_id
                        WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
                ))
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.bib_material_liberado_para(_material_id uuid, _person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- A pasta manda: material dentro de pasta trancada fica trancado.
    public.bib_pasta_liberada_para(
      (SELECT m.pasta_id FROM public.biblioteca_materiais m WHERE m.id = _material_id),
      _person_id)
    AND (
      NOT EXISTS (SELECT 1 FROM public.biblioteca_material_destinos d
                   WHERE d.material_id = _material_id)
      OR EXISTS (
           SELECT 1 FROM public.biblioteca_material_destinos d
            WHERE d.material_id = _material_id
              AND (d.person_id = _person_id
                   OR d.group_id IN (SELECT gm.group_id FROM public.group_members gm
                                      WHERE gm.person_id = _person_id)))
    );
$function$
;

CREATE OR REPLACE FUNCTION public.bib_pasta_liberada(_pasta_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    _pasta_id IS NULL
    -- A equipe da conta abre tudo: a tranca e para o aluno. Precisa vir
    -- primeiro, senao o dono perde de vista o proprio material trancado e nao
    -- tem como destrancar o que sumiu.
    OR EXISTS (SELECT 1 FROM public.biblioteca_pastas p
                WHERE p.id = _pasta_id AND p.mentor_id = public.acting_account())
    OR NOT EXISTS (SELECT 1 FROM public.biblioteca_pasta_destinos d
                    WHERE d.pasta_id = _pasta_id)
    OR EXISTS (
         SELECT 1 FROM public.biblioteca_pasta_destinos d
          WHERE d.pasta_id = _pasta_id
            AND (
              d.person_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
              OR d.group_id IN (
                   SELECT gm.group_id FROM public.group_members gm
                     JOIN public.people p ON p.id = gm.person_id
                    WHERE p.user_id = auth.uid())
              OR d.group_id IN (
                   SELECT tmg.group_id FROM public.team_member_groups tmg
                     JOIN public.team_members tm ON tm.id = tmg.team_member_id
                    WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
            ));
$function$
;

CREATE OR REPLACE FUNCTION public.bib_pasta_liberada_para(_pasta_id uuid, _person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _pasta_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.biblioteca_pasta_destinos d
                      WHERE d.pasta_id = _pasta_id)
      OR EXISTS (
           SELECT 1 FROM public.biblioteca_pasta_destinos d
            WHERE d.pasta_id = _pasta_id
              AND (d.person_id = _person_id
                   OR d.group_id IN (SELECT gm.group_id FROM public.group_members gm
                                      WHERE gm.person_id = _person_id)));
$function$
;

CREATE OR REPLACE FUNCTION public.bib_pastas_liberadas(_person_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id FROM public.biblioteca_pastas p
   WHERE CASE
           WHEN _person_id IS NULL THEN public.bib_pasta_liberada(p.id)
           -- Previa: so o dono da conta daquela pessoa pode perguntar pelo
           -- acesso dela. Sem esta trava, qualquer aluno leria o acesso alheio.
           WHEN EXISTS (SELECT 1 FROM public.people pe
                         WHERE pe.id = _person_id
                           AND pe.mentor_id = public.acting_account())
             THEN public.bib_pasta_liberada_para(p.id, _person_id)
           ELSE false
         END;
$function$
;

CREATE OR REPLACE FUNCTION public.bloqueia_apagar_versao_em_uso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.test_responses r WHERE r.version_id = OLD.id;
  IF v_n > 0 THEN
    RAISE EXCEPTION
      'Este teste ja foi respondido % vez(es). Apagar levaria junto as respostas e os relatorios. Despublique a versao para parar de usa-la sem perder o historico.', v_n
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_edit_track(_track_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.member_kind() <> 'mentor'
     AND EXISTS (
       SELECT 1 FROM public.learning_tracks t
        WHERE t.id = _track_id AND t.owner_id = public.acting_account()
     );
$function$
;

CREATE OR REPLACE FUNCTION public.can_see_person(p_person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.member_kind() <> 'mentor'
      OR EXISTS (
        SELECT 1 FROM public.group_members gm
         WHERE gm.person_id = p_person_id
           AND gm.group_id IN (SELECT public.visible_group_ids())
      );
$function$
;

CREATE OR REPLACE FUNCTION public.can_see_track(_track_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.learning_tracks t
     WHERE t.id = _track_id
       AND (
         t.owner_id = public.acting_account()
         OR (
           t.is_published
           AND t.audience IN ('alunos', 'ambos')
           AND t.owner_id IN (SELECT p.mentor_id FROM public.people p WHERE p.user_id = auth.uid())
           AND public.aluno_pode('academy')
         )
       )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.claim_invite_link(link_id uuid)
 RETURNS SETOF invite_links
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.invite_links
  SET response_count = response_count + 1
  WHERE id = link_id
    AND is_active
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_responses IS NULL OR response_count < max_responses)
  RETURNING *;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_student_profile()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL THEN RETURN 0; END IF;

  UPDATE public.people p
     SET user_id = v_uid
   WHERE lower(p.email) = lower(v_email)
     AND p.user_id IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Ja vinculado e com email diferente: o de acesso e o que vale.
  UPDATE public.people p
     SET email = v_email
   WHERE p.user_id = v_uid
     AND lower(p.email) <> lower(v_email);

  -- ---- Os pontos de presenca que ficaram para tras ----
  INSERT INTO public.pontos (user_id, mentor_id, acao, pontos, referencia)
  SELECT v_uid, t.mentor_id, 'presenca', 20, pr.aula_id
    FROM public.treinamento_presencas pr
    JOIN public.people pe          ON pe.id = pr.person_id AND pe.user_id = v_uid
    JOIN public.treinamento_aulas a ON a.id = pr.aula_id
    JOIN public.treinamento_modulos m ON m.id = a.modulo_id
    JOIN public.treinamentos t      ON t.id = m.treinamento_id
   WHERE a.fechada_em IS NOT NULL
     AND NOT a.cancelada
     -- Presente ou atrasado. `situacao` preenchida e a marcacao do professor,
     -- que vence; vazia com registro de scan significa que compareceu.
     AND (pr.situacao IS NULL OR pr.situacao IN ('presente', 'atrasado'))
  ON CONFLICT DO NOTHING;

  RETURN v_n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.grants_excecoes()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT ARRAY[
    'track_liberada_para',
    'bib_pasta_liberada_para',
    'bib_material_liberado_para'
  ];
$function$
;

CREATE OR REPLACE FUNCTION public.grants_faltando()
 RETURNS TABLE(funcao text, assinatura text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.proname::text,
         pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef                                   -- SECURITY DEFINER
     AND NOT (p.proname = ANY (public.grants_excecoes()))
     AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
   ORDER BY 1;
$function$
;

CREATE OR REPLACE FUNCTION public.limpar_ponto_da_presenca()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.pontos p
   USING public.people pe
   WHERE pe.id = OLD.person_id
     AND p.user_id = pe.user_id
     AND p.acao = 'presenca'
     AND p.referencia = OLD.aula_id;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.member_kind()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT tm.kind FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'ativo'
      ORDER BY tm.created_at LIMIT 1),
    'owner'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.meus_grupos_como_avaliado()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT gm.group_id
    FROM public.group_members gm
   WHERE gm.person_id IN (SELECT public.my_person_ids());
$function$
;

CREATE OR REPLACE FUNCTION public.minha_conexao_google()
 RETURNS TABLE(conectado boolean, email text, conectado_em timestamp with time zone, ultimo_erro text, ultimo_uso_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT true, g.email, g.conectado_em, g.ultimo_erro, g.ultimo_uso_em
    FROM public.google_conexoes g
   WHERE g.user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.minhas_areas()
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a FROM unnest(ARRAY['resultados','comunidade','devolutivas','agenda','academy','classroom']) a
   WHERE public.aluno_pode(a);
$function$
;

CREATE OR REPLACE FUNCTION public.my_person_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id FROM public.people p WHERE p.user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.nome_do_mentor(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.full_name
    FROM public.profiles p
   WHERE p.user_id = p_user_id
     AND EXISTS (
       SELECT 1 FROM public.devolutivas d
        WHERE d.created_by = p_user_id
          AND d.person_id IN (SELECT public.my_person_ids())
     );
$function$
;

CREATE OR REPLACE FUNCTION public.notificar(p_conta uuid, p_tipo text, p_titulo text, p_corpo text DEFAULT NULL::text, p_link text DEFAULT NULL::text, p_ator uuid DEFAULT NULL::uuid, p_ator_nome text DEFAULT NULL::text, p_grupos uuid[] DEFAULT NULL::uuid[], p_pessoa_user uuid DEFAULT NULL::uuid, p_para_alunos boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_destinos uuid[];
BEGIN
  -- ---- QUEM PODE ESCREVER NO SINO DE QUEM (guarda nova, 30/07/2026) ----
  --
  -- Ate hoje esta funcao aceitava qualquer chamador. Combinada com o EXECUTE
  -- que estava concedido a PUBLIC, isso significava: qualquer pessoa da
  -- internet escrevia uma notificacao com titulo e LINK arbitrarios no sino de
  -- qualquer conta -- e ela chega com a cara do sistema. A migracao
  -- 20260730340000 revogou o acesso anonimo; esta guarda fecha o resto.
  --
  -- auth.uid() NULO = service role. E o caminho dos endpoints publicos
  -- (avisarQueRespondeu, no envio de resposta), que ja passou pela sua propria
  -- checagem antes de chegar aqui. `anon` nao cai mais neste ramo porque o
  -- EXECUTE dele foi revogado -- as duas coisas juntas e que fecham.
  --
  -- LOGADO: so escreve na conta a que ele pertence. Tres portas, as mesmas do
  -- resto da plataforma: o dono, quem e da equipe, e quem e avaliado ali.
  -- Levanta excecao em vez de devolver 0 em silencio: o TypeScript ja engole a
  -- falha (notificacao nunca derruba a acao), entao um aviso legitimo nunca ve
  -- este erro, e um ilegitimo fica registrado no log do banco.
  IF auth.uid() IS NOT NULL AND NOT (
       auth.uid() = p_conta
       OR EXISTS (SELECT 1 FROM public.team_members tm
                   WHERE tm.user_id = auth.uid()
                     AND tm.owner_id = p_conta
                     AND tm.status = 'ativo')
       OR EXISTS (SELECT 1 FROM public.people pe
                   WHERE pe.user_id = auth.uid()
                     AND pe.mentor_id = p_conta)
     ) THEN
    RAISE EXCEPTION 'Sem permissao para notificar nesta conta.';
  END IF;
  SELECT array_agg(DISTINCT u) INTO v_destinos FROM (
    -- 1. O MASTER vê tudo que acontece na conta dele.
    SELECT p_conta AS u

    UNION
    -- 2. MENTORES. Duas portas: o grupo é dele, ou é novidade do master
    --    (`p_grupos IS NULL` = anúncio da conta inteira).
    SELECT tm.user_id
      FROM public.team_members tm
      LEFT JOIN public.team_member_groups tmg ON tmg.team_member_id = tm.id
     WHERE tm.owner_id = p_conta
       AND tm.status = 'ativo'
       AND tm.kind IN ('mentor', 'colaborador')
       AND tm.user_id IS NOT NULL
       AND (p_grupos IS NULL OR tmg.group_id = ANY(p_grupos))

    UNION
    -- 3. O ALUNO DE QUEM O EVENTO TRATA. Sempre, mesmo fora de grupo: é sobre
    --    ele. É o "referente a ele mesmo" da regra.
    SELECT p_pessoa_user WHERE p_pessoa_user IS NOT NULL

    UNION
    -- 4. OS DEMAIS ALUNOS dos grupos, só quando o evento é de comunidade.
    SELECT pe.user_id
      FROM public.people pe
      JOIN public.group_members gm ON gm.person_id = pe.id
     WHERE p_para_alunos
       AND p_grupos IS NOT NULL
       AND gm.group_id = ANY(p_grupos)
       AND pe.user_id IS NOT NULL
  ) alvos(u)
  WHERE u IS NOT NULL AND u IS DISTINCT FROM p_ator;

  IF v_destinos IS NULL OR array_length(v_destinos, 1) IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notificacoes (user_id, conta_id, tipo, titulo, corpo, link, ator_nome)
  SELECT d, p_conta, p_tipo, p_titulo, p_corpo, p_link, p_ator_nome
    FROM unnest(v_destinos) AS d;

  RETURN array_length(v_destinos, 1);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.option_version_id(_option_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT q.version_id FROM public.test_options o
  JOIN public.test_questions q ON q.id = o.question_id
  WHERE o.id = _option_id;
$function$
;

CREATE OR REPLACE FUNCTION public.owns_test_version(_version_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.test_versions v
    WHERE v.id = _version_id AND v.mentor_id = public.acting_account()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.perfil_do_colega(p_person uuid)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, role_at_company text, profession text, email text, phone text, autorizou boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.full_name, p.avatar_url, p.role_at_company,
    -- O dono v√™ tudo (j√° v√™ em Pessoas). Para os colegas, s√≥ o que foi
    -- autorizado ‚Äî e o corte √© aqui, no banco: escondido no HTML n√£o √©
    -- escondido.
    CASE WHEN p.perfil_visivel OR p.mentor_id = auth.uid() THEN p.profession END,
    CASE WHEN p.perfil_visivel OR p.mentor_id = auth.uid() THEN p.email END,
    CASE WHEN p.perfil_visivel OR p.mentor_id = auth.uid() THEN p.phone END,
    p.perfil_visivel OR p.mentor_id = auth.uid()
  FROM public.people p
  WHERE p.id = p_person
    AND (
      -- O dono da conta.
      p.mentor_id = auth.uid()
      -- Ou algu√©m que divide grupo com ela.
      OR EXISTS (
        SELECT 1
          FROM public.group_members meu
          JOIN public.group_members dele ON dele.group_id = meu.group_id
          JOIN public.people eu ON eu.id = meu.person_id
         WHERE eu.user_id = auth.uid() AND dele.person_id = p.id)
    );
$function$
;

CREATE OR REPLACE FUNCTION public.posso_agendar_devolutiva(p_person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.member_kind() <> 'mentor'
    OR EXISTS (
      SELECT 1
        FROM public.group_members gm
        JOIN public.team_member_groups tmg ON tmg.group_id = gm.group_id
        JOIN public.team_members tm ON tm.id = tmg.team_member_id
       WHERE gm.person_id = p_person_id
         AND tm.user_id = auth.uid()
         AND tmg.can_schedule_devolutivas
    );
$function$
;

CREATE OR REPLACE FUNCTION public.posso_dar_aula(p_aula uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- A conta dona do treinamento. acting_account() cobre o dono e os
    -- colaboradores dele.
    SELECT 1
      FROM public.treinamento_aulas a
      JOIN public.treinamento_modulos m ON m.id = a.modulo_id
      JOIN public.treinamentos t ON t.id = m.treinamento_id
     WHERE a.id = p_aula AND t.mentor_id = public.acting_account()
  ) OR EXISTS (
    -- O mentor atribuido a um grupo do treinamento.
    SELECT 1
      FROM public.treinamento_aulas a
      JOIN public.treinamento_modulos m ON m.id = a.modulo_id
      JOIN public.treinamento_grupos tg ON tg.treinamento_id = m.treinamento_id
      JOIN public.team_member_groups tmg ON tmg.group_id = tg.group_id
      JOIN public.team_members tm ON tm.id = tmg.team_member_id
     WHERE a.id = p_aula
       AND tm.user_id = auth.uid() AND tm.status = 'ativo'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.posso_moderar_post(p_post uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.community_post_groups pg
      JOIN public.groups g ON g.id = pg.group_id
     WHERE pg.post_id = p_post
       AND (
         g.mentor_id = auth.uid()
         OR EXISTS (
              SELECT 1 FROM public.team_member_groups tmg
                JOIN public.team_members tm ON tm.id = tmg.team_member_id
               WHERE tmg.group_id = g.id
                 AND tm.user_id = auth.uid()
                 AND tm.status = 'ativo'
                 AND tm.kind IN ('mentor', 'colaborador'))
       )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.posso_ver_evento(p_evento uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- O dono da conta: o evento e dele.
    EXISTS (SELECT 1 FROM public.eventos e
             WHERE e.id = p_evento AND e.conta_id = auth.uid())
    OR (
      -- aluno_pode devolve true para a equipe, entao o mentor que acompanha o
      -- grupo continua passando por aqui.
      public.aluno_pode('agenda')
      AND EXISTS (
        SELECT 1 FROM public.evento_destinos d
         WHERE d.evento_id = p_evento
           AND (
             d.person_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
             OR d.group_id IN (
                  SELECT gm.group_id FROM public.group_members gm
                    JOIN public.people p ON p.id = gm.person_id
                   WHERE p.user_id = auth.uid())
             OR d.group_id IN (
                  SELECT tmg.group_id FROM public.team_member_groups tmg
                    JOIN public.team_members tm ON tm.id = tmg.team_member_id
                   WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
           ))
    );
$function$
;

CREATE OR REPLACE FUNCTION public.posso_ver_grupo(p_group_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Lado da equipe: o grupo √© da conta, e o mentor convidado s√≥ enxerga os
    -- grupos atribu√≠dos a ele. Par√™nteses expl√≠citos de prop√≥sito: sem eles a
    -- preced√™ncia entre AND e OR ainda d√° o resultado certo, mas ningu√©m
    -- consegue conferir isso de bater o olho.
    (
      EXISTS (SELECT 1 FROM public.groups g
               WHERE g.id = p_group_id AND g.mentor_id = public.acting_account())
      AND (
        public.member_kind() <> 'mentor'
        OR p_group_id IN (SELECT public.visible_group_ids())
      )
    )
    -- Lado do avaliado: estou nesse grupo.
    OR (p_group_id IN (SELECT public.meus_grupos_como_avaliado()));
$function$
;

CREATE OR REPLACE FUNCTION public.posso_ver_post(p_post_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.aluno_pode('comunidade')
     AND EXISTS (
       SELECT 1 FROM public.community_post_groups g
        WHERE g.post_id = p_post_id AND public.posso_ver_grupo(g.group_id)
     );
$function$
;

CREATE OR REPLACE FUNCTION public.posso_ver_treinamento(p_trein uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.treinamentos t
     WHERE t.id = p_trein AND t.mentor_id = auth.uid()
  ) OR (
    public.aluno_pode('classroom')
    AND EXISTS (
      SELECT 1
        FROM public.treinamentos t
        JOIN public.treinamento_grupos tg ON tg.treinamento_id = t.id
        JOIN public.group_members gm ON gm.group_id = tg.group_id
        JOIN public.people p ON p.id = gm.person_id
       WHERE t.id = p_trein AND t.publicado AND p.user_id = auth.uid()
    )
  ) OR EXISTS (
    SELECT 1
      FROM public.treinamento_grupos tg
      JOIN public.team_member_groups tmg ON tmg.group_id = tg.group_id
      JOIN public.team_members tm ON tm.id = tmg.team_member_id
     WHERE tg.treinamento_id = p_trein
       AND tm.user_id = auth.uid() AND tm.status = 'ativo'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.promover_a_mentor(p_person_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono uuid := public.acting_account();
  v_pessoa record;
  v_id uuid;
BEGIN
  IF v_dono IS NULL OR v_dono <> auth.uid() THEN
    RAISE EXCEPTION 'S√≥ o dono da conta pode promover algu√©m a mentor.';
  END IF;

  SELECT id, full_name, email, user_id, mentor_id INTO v_pessoa
    FROM public.people WHERE id = p_person_id AND mentor_id = v_dono;
  IF v_pessoa.id IS NULL THEN
    RAISE EXCEPTION 'Pessoa n√£o encontrada nesta conta.';
  END IF;

  SELECT id INTO v_id FROM public.team_members WHERE person_id = p_person_id;
  IF v_id IS NOT NULL THEN
    UPDATE public.team_members SET kind = 'mentor', status = 'ativo' WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.team_members (owner_id, person_id, name, email, kind, status, user_id, accepted_at)
  VALUES (
    v_dono, p_person_id, v_pessoa.full_name, lower(v_pessoa.email), 'mentor',
    -- J√° tem login: entra como mentor na hora. Ainda n√£o: o primeiro acesso do
    -- aluno resolve, e √© o mesmo caminho de sempre.
    CASE WHEN v_pessoa.user_id IS NULL THEN 'convidado' ELSE 'ativo' END,
    v_pessoa.user_id,
    CASE WHEN v_pessoa.user_id IS NULL THEN NULL ELSE now() END
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.question_version_id(_question_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT version_id FROM public.test_questions WHERE id = _question_id;
$function$
;

CREATE OR REPLACE FUNCTION public.rebaixar_mentor(p_person_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono uuid := public.acting_account();
BEGIN
  IF v_dono IS NULL OR v_dono <> auth.uid() THEN
    RAISE EXCEPTION 'S√≥ o dono da conta pode remover o papel de mentor.';
  END IF;
  DELETE FROM public.team_members
   WHERE person_id = p_person_id AND owner_id = v_dono AND kind = 'mentor';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reconceder_grants()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
     WHERE nsp.nspname = 'public'
       AND p.prosecdef
       AND NOT (p.proname = ANY (public.grants_excecoes()))
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
                   r.proname, r.args);
    n := n + 1;
  END LOOP;

  -- As excecoes no caminho inverso: se alguem der grant nelas por engano (ou
  -- se uma migracao antiga concedeu antes de a regra existir), tira de volta.
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
     WHERE nsp.nspname = 'public'
       AND p.prosecdef
       AND p.proname = ANY (public.grants_excecoes())
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated, anon',
                   r.proname, r.args);
  END LOOP;

  RETURN n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.response_mentor_id(_response_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT mentor_id FROM public.test_responses WHERE id = _response_id;
$function$
;

CREATE OR REPLACE FUNCTION public.retrato_do_schema()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH tabelas AS (
    SELECT format(
      E'-- ============ TABELA %s ============\n%s\n',
      c.relname,
      string_agg(
        format('--   %s %s%s', a.attname, format_type(a.atttypid, a.atttypmod),
               CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END),
        E'\n' ORDER BY a.attnum)
    ) AS txt, c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     GROUP BY c.relname
  ),
  policies AS (
    SELECT format(
      E'-- policy %s.%s [%s]\n--   USING %s\n--   CHECK %s\n',
      p.tablename, p.policyname, p.cmd,
      COALESCE(p.qual, '-'), COALESCE(p.with_check, '-')
    ) AS txt, p.tablename, p.policyname
      FROM pg_policies p
     WHERE p.schemaname = 'public'
  ),
  funcoes AS (
    SELECT pg_get_functiondef(pr.oid) || E';\n' AS txt, pr.proname
      FROM pg_proc pr
      JOIN pg_namespace n ON n.oid = pr.pronamespace
     WHERE n.nspname = 'public' AND pr.prokind = 'f'
  ),
  indices AS (
    SELECT indexdef || E';\n' AS txt, indexname
      FROM pg_indexes WHERE schemaname = 'public'
  )
  SELECT
    E'-- ===================== TABELAS =====================\n'
    || COALESCE((SELECT string_agg(txt, E'\n' ORDER BY relname) FROM tabelas), '')
    || E'\n-- ===================== POLICIES =====================\n'
    || COALESCE((SELECT string_agg(txt, '' ORDER BY tablename, policyname) FROM policies), '')
    || E'\n-- ===================== INDICES =====================\n'
    || COALESCE((SELECT string_agg(txt, '' ORDER BY indexname) FROM indices), '')
    || E'\n-- ===================== FUNCOES =====================\n'
    || COALESCE((SELECT string_agg(txt, E'\n' ORDER BY proname) FROM funcoes), '');
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sou_autor_do_post(p_post_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.community_posts p
     WHERE p.id = p_post_id AND p.author_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.test_version_is_template(_version_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT is_template FROM public.test_versions WHERE id = _version_id), false);
$function$
;

CREATE OR REPLACE FUNCTION public.track_liberada(_track_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- A equipe da conta abre tudo: a tranca e para o aluno.
    EXISTS (SELECT 1 FROM public.learning_tracks t
             WHERE t.id = _track_id AND t.owner_id = public.acting_account())
    OR NOT EXISTS (
         SELECT 1 FROM public.learning_track_destinos d WHERE d.track_id = _track_id)
    OR EXISTS (
         SELECT 1 FROM public.learning_track_destinos d
          WHERE d.track_id = _track_id
            AND (
              -- Enderecada a mim, pessoalmente.
              d.person_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
              -- Ou a um grupo em que eu estou.
              OR d.group_id IN (
                   SELECT gm.group_id FROM public.group_members gm
                     JOIN public.people p ON p.id = gm.person_id
                    WHERE p.user_id = auth.uid())
              -- Ou a um grupo que eu acompanho como mentor.
              OR d.group_id IN (
                   SELECT tmg.group_id FROM public.team_member_groups tmg
                     JOIN public.team_members tm ON tm.id = tmg.team_member_id
                    WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
            )
       );
$function$
;

CREATE OR REPLACE FUNCTION public.track_liberada_para(_track_id uuid, _person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
           SELECT 1 FROM public.learning_track_destinos d WHERE d.track_id = _track_id
         )
      OR EXISTS (
           SELECT 1 FROM public.learning_track_destinos d
            WHERE d.track_id = _track_id
              AND (
                d.person_id = _person_id
                OR d.group_id IN (
                     SELECT gm.group_id FROM public.group_members gm
                      WHERE gm.person_id = _person_id)
              )
         );
$function$
;

CREATE OR REPLACE FUNCTION public.trilhas_liberadas(_person_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.id
    FROM public.learning_tracks t
   WHERE public.can_see_track(t.id)
     AND CASE
           WHEN _person_id IS NULL THEN public.track_liberada(t.id)
           -- Previa: so o dono da conta daquela pessoa pode perguntar pelo
           -- acesso dela. Sem esta trava, qualquer aluno leria o acesso alheio.
           WHEN EXISTS (SELECT 1 FROM public.people p
                         WHERE p.id = _person_id
                           AND p.mentor_id = public.acting_account())
             THEN public.track_liberada_para(t.id, _person_id)
           ELSE false
         END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_my_person(_full_name text, _phone text DEFAULT NULL::text, _avatar_url text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado.';
  END IF;
  IF length(btrim(COALESCE(_full_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Informe o seu nome.';
  END IF;

  -- Atribuição direta, sem COALESCE: a tela manda o formulário inteiro, então
  -- campo vazio quer dizer "apagar" — com COALESCE não daria para remover a foto.
  -- Vale para todos os cadastros da pessoa: quem é aluno de dois mentores
  -- atualiza os dois de uma vez, que é o que ela espera.
  UPDATE public.people p
     SET full_name  = btrim(_full_name),
         phone      = NULLIF(btrim(COALESCE(_phone, '')), ''),
         avatar_url = NULLIF(btrim(COALESCE(_avatar_url, '')), '')
   WHERE p.user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.visible_group_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.id FROM public.groups g
   WHERE g.mentor_id = public.acting_account()
     AND (
       public.member_kind() <> 'mentor'
       OR g.id IN (
         SELECT tmg.group_id FROM public.team_member_groups tmg
           JOIN public.team_members tm ON tm.id = tmg.team_member_id
          WHERE tm.user_id = auth.uid() AND tm.status = 'ativo'
       )
     );
$function$
;

