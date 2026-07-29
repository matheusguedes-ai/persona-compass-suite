-- Cada pessoa decide se os colegas de grupo veem os dados dela.
--
-- O Matheus pediu para liberar o perfil entre membros da mesma comunidade, com
-- uma chave no "Meu perfil" para cada um permitir ou não.
--
-- PADRÃO É FALSO, e isso é decisão de projeto, não descuido.
--
-- Já existe gente cadastrada. Se a coluna nascesse `true`, o telefone e o
-- e-mail de todo mundo ficariam visíveis para os colegas no instante da
-- migração, sem ninguém ter sido perguntado. Nascendo `false`, quem quiser
-- aparecer liga a chave — e aí é escolha, não surpresa.
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS perfil_visivel boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.people.perfil_visivel IS
  'A pessoa autoriza os colegas de grupo a verem contato e profissão. Foto, nome e cargo aparecem sempre; resultado de teste NUNCA entra aqui.';

/**
 * O perfil de um colega, com o que ele autorizou.
 *
 * SECURITY DEFINER porque a resposta depende de cruzar `group_members` dos dois
 * lados — e a RLS de `people` não deixaria um avaliado ler a linha de outro.
 *
 * ⚠️ A lista de campos é curta de propósito e NÃO inclui resultado de teste.
 * Publicar resultado é outra função, com consentimento próprio. Se alguém um
 * dia acrescentar `computed_scores` aqui, terá furado essa separação sem
 * perceber.
 */
CREATE OR REPLACE FUNCTION public.perfil_do_colega(p_person uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  role_at_company text,
  profession text,
  email text,
  phone text,
  autorizou boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.role_at_company,
    -- Só sai o que ele autorizou. A checagem é aqui, no banco: se ficasse na
    -- tela, o dado já teria viajado até o navegador antes de ser escondido.
    CASE WHEN p.perfil_visivel THEN p.profession END,
    CASE WHEN p.perfil_visivel THEN p.email END,
    CASE WHEN p.perfil_visivel THEN p.phone END,
    p.perfil_visivel
  FROM public.people p
  WHERE p.id = p_person
    -- E só se dividimos algum grupo. Sem isto, qualquer pessoa logada leria o
    -- perfil de qualquer avaliado da plataforma passando o id.
    AND EXISTS (
      SELECT 1
        FROM public.group_members meu
        JOIN public.group_members dele ON dele.group_id = meu.group_id
        JOIN public.people eu ON eu.id = meu.person_id
       WHERE eu.user_id = auth.uid()
         AND dele.person_id = p.id
    );
$fn$;

GRANT EXECUTE ON FUNCTION public.perfil_do_colega(uuid) TO authenticated;
