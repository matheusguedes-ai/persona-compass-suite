-- O dono da conta também vê o perfil, e a tela deixa de abrir vazia.
--
-- A regra "só quem divide grupo" está certa para COLEGA, mas o dono não é
-- colega: ele já vê tudo em Pessoas. Barrá-lo aqui não protegia nada — só
-- produzia um pop-up em branco, sem explicação, que parece defeito.
CREATE OR REPLACE FUNCTION public.perfil_do_colega(p_person uuid)
RETURNS TABLE (
  id uuid, full_name text, avatar_url text, role_at_company text,
  profession text, email text, phone text, autorizou boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    p.id, p.full_name, p.avatar_url, p.role_at_company,
    -- O dono vê tudo (já vê em Pessoas). Para os colegas, só o que foi
    -- autorizado — e o corte é aqui, no banco: escondido no HTML não é
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
      -- Ou alguém que divide grupo com ela.
      OR EXISTS (
        SELECT 1
          FROM public.group_members meu
          JOIN public.group_members dele ON dele.group_id = meu.group_id
          JOIN public.people eu ON eu.id = meu.person_id
         WHERE eu.user_id = auth.uid() AND dele.person_id = p.id)
    );
$fn$;
GRANT EXECUTE ON FUNCTION public.perfil_do_colega(uuid) TO authenticated;
