-- Dados da empresa no rodapé — item K.
--
-- `profiles` já tem `company_name`, `site_url` e `support_email`. Faltam os
-- que identificam juridicamente quem opera a plataforma.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_cnpj text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  -- ⚠️ A chave existe porque o rodapé aparece em DOIS mundos: as telas internas
  -- e as páginas abertas por link — o teste e o relatório, que não pedem login.
  -- CNPJ e endereço ali ficam visíveis para quem tiver o link. Para dado de
  -- empresa isso costuma ser aceitável (é o rodapé de qualquer site), mas é
  -- escolha do dono, não padrão que eu imponho.
  ADD COLUMN IF NOT EXISTS company_footer_public boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.company_footer_public IS
  'Mostrar o rodapé da empresa também nas páginas públicas (teste e relatório).';
