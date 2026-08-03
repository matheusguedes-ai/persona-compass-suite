-- Ícone do app (#235) — separado da logo.
--
-- A logo é horizontal, com o nome escrito; o ícone precisa ser quadrado e
-- legível em 48px (a tela de instalar do celular). Guarda no MESMO bucket
-- privado 'marca' que já vale para logo_url, só que num identificador
-- próprio — ninguém troca um pelo outro sem querer.
--
-- Aditiva só: nada é renomeado, removido ou muda de regra. Pode ir antes do
-- código, como qualquer coluna nova.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS icon_url text;
