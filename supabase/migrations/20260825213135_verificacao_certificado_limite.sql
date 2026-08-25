-- #221 F3 — limite de tentativas para a verificação pública de certificado.
--
-- Não é dado de mentor nem de aluno: é um contador de abuso por origem (IP),
-- compartilhado por toda a plataforma, sem relação com conta_id nenhuma —
-- não existe "dono" de uma tentativa de consulta de um código aleatório, por
-- isso esta tabela não nasce com coluna de dono (foge do padrão de
-- #271/#272 de propósito, e a razão está registrada aqui). RLS ligada e SEM
-- nenhuma policy para authenticated/anon: só o service role toca esta
-- tabela, a partir do servidor (verificarCertificado em
-- certificados.functions.ts). Uma linha por origem, que a própria aplicação
-- reseta quando a janela vence — sem histórico de tentativa por tentativa.
CREATE TABLE public.verificacao_certificado_limite (
  origem text PRIMARY KEY,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  tentativas integer NOT NULL DEFAULT 1
);

ALTER TABLE public.verificacao_certificado_limite ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.verificacao_certificado_limite TO service_role;
