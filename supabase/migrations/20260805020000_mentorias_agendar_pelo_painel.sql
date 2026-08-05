-- Menu Mentorias — #255: o aluno agenda pelo painel logado (sem link por
-- e-mail), apontando o link no próprio pacote.
--
-- Puramente aditiva: uma coluna nova em mentorias (link_id, o pacote aponta
-- o link) e um terceiro valor no CHECK de mentoria_sessoes.origem, para
-- distinguir "agendado pelo painel logado" de "agendado pelo link público
-- sem login" (que já usa 'link'). Nada publicado lê mentorias.link_id nem
-- escreve origem='painel' hoje — ambos os lados (coluna e valor) só passam
-- a existir de verdade quando o código desta demanda for publicado.

ALTER TABLE public.mentorias
  ADD COLUMN IF NOT EXISTS link_id uuid REFERENCES public.mentoria_links(id) ON DELETE SET NULL;

-- ON DELETE SET NULL de propósito (igual mentoria_sessoes.link_id, #254):
-- apagar um link não pode apagar pacote de ninguém. O pacote fica sem link
-- e o painel do aluno explica — nunca quebra silenciosamente.
CREATE INDEX IF NOT EXISTS mentorias_link_idx ON public.mentorias (link_id);

ALTER TABLE public.mentoria_sessoes DROP CONSTRAINT IF EXISTS mentoria_sessoes_origem_check;
ALTER TABLE public.mentoria_sessoes ADD CONSTRAINT mentoria_sessoes_origem_check
  CHECK (origem IN ('manual', 'link', 'painel'));
