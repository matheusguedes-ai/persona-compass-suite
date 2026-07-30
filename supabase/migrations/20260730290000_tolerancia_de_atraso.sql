-- O limiar de atraso deixa de ser 10 minutos gravados no codigo.
--
-- Dez minutos e um chute razoavel e nada mais. Curso noturno em cidade grande
-- perde metade da turma no transito e marca "atrasado" quem saiu do trabalho no
-- horario; workshop de meio periodo com sessoes de 50 minutos precisa de tres,
-- nao de dez. O numero e uma decisao pedagogica de quem da o curso, e estava
-- numa constante de TypeScript.
--
-- Por treinamento, e nao por aula: e politica do curso, e repetir a escolha em
-- toda aula so criaria a chance de duas aulas do mesmo curso divergirem.
--
-- ZERO E VALIDO e significa "qualquer minuto depois do inicio ja e atraso" --
-- rigor que curso de compliance as vezes exige. O teto de 120 existe para o
-- campo nao virar jeito de desligar o atraso por acidente: quem quer desligar
-- coloca 120 sabendo o que fez.
--
-- Nao mexe em pontuacao: presente e atrasado contam igual como presenca
-- (`contaComoPresenca`), entao isto muda o ROTULO e a planilha que vai para o
-- RH -- que e justamente onde o numero importa.

ALTER TABLE public.treinamentos
  ADD COLUMN IF NOT EXISTS tolerancia_atraso_min integer NOT NULL DEFAULT 10;

ALTER TABLE public.treinamentos
  DROP CONSTRAINT IF EXISTS treinamentos_tolerancia_check;
ALTER TABLE public.treinamentos
  ADD CONSTRAINT treinamentos_tolerancia_check
  CHECK (tolerancia_atraso_min BETWEEN 0 AND 120);
