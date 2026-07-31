-- O material sabe se veio de upload ou de link colado -- guardado, não adivinhado.
--
-- A tela de editar material decide se mostra o widget de upload ou a caixa de
-- link olhando o FORMATO da URL salva: `m.url.includes(".../object/public/
-- biblioteca/...")`. Funciona hoje porque o bucket é público e a URL sempre
-- tem essa cara. No momento em que a URL passa a ser assinada (bucket privado,
-- link com token e prazo), o formato muda e a checagem erra silenciosamente --
-- todo material já enviado passaria a abrir como se fosse link externo.
--
-- Em vez de trocar por outra adivinhação de formato, a informação passa a ser
-- GRAVADA no mesmo instante em que a pessoa escolhe -- ela já sabe se clicou em
-- "Enviar arquivo" ou colou um link; só nunca guardávamos essa escolha.
--
-- BACKFILL, não regra permanente: preenche as linhas que já existem olhando o
-- formato de hoje (o bucket ainda é público neste momento da migração). É a
-- ÚLTIMA vez que o formato da URL decide isso -- dali em diante, quem decide é
-- a escolha da pessoa no formulário.

ALTER TABLE public.biblioteca_materiais
  ADD COLUMN IF NOT EXISTS arquivo_proprio boolean NOT NULL DEFAULT false;

UPDATE public.biblioteca_materiais
   SET arquivo_proprio = true
 WHERE url LIKE '%/storage/v1/object/public/biblioteca/%'
   AND NOT arquivo_proprio;
