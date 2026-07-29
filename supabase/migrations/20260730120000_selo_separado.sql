-- Separa o nome da MARCA do nome da EMPRESA.
--
-- Ao preencher `company_name` para o selo do rodapé, a plataforma inteira
-- passou a se chamar "Método Intenção" — porque esse campo já era o nome da
-- marca. Não foi escolha do Matheus, foi efeito colateral.
--
-- São coisas diferentes: a marca é o que o aluno lê no topo; o selo é quem
-- responde juridicamente pelo sistema. Podem coincidir, mas não são o mesmo
-- campo.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_seal_name text,
  -- Nunca foi usada: o Matheus decidiu que o selo aparece em TODAS as telas.
  DROP COLUMN IF EXISTS company_footer_public,
  -- Endereço saiu do selo a pedido dele. Sem uso, sai também.
  DROP COLUMN IF EXISTS company_address;

COMMENT ON COLUMN public.profiles.company_seal_name IS
  'Nome no selo do rodapé (quem opera o sistema). Diferente de company_name, que é a marca.';

-- Move o que eu tinha gravado para o campo certo e devolve a marca.
UPDATE public.profiles
   SET company_seal_name = 'Método Intenção',
       company_name = NULL
 WHERE company_cnpj = '63.970.731/0001-80';
