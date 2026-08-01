-- Demanda #21: rastro e titularidade na exportação de Pessoas.
--
-- Dado pessoal saindo da plataforma merece registro — não para impedir nada
-- (a exportação continua livre pra quem tem a permissão `pessoas`), só para
-- existir um rastro que sobrevive ao arquivo em si: se o arquivo for editado,
-- perdido ou repassado, a conta ainda sabe QUEM exportou, QUANDO e QUANTAS
-- pessoas — sem depender do rodapé do arquivo, que é só a parte legível por
-- quem recebe o arquivo.
--
-- Aditivo puro (tabela nova). Pode ir antes do código, como já registrado
-- nas outras migrações desta leva.

CREATE TABLE public.export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- De quem são os dados — acting_account(), não quem clicou. Um colaborador
  -- que exporta Pessoas está exportando dado da CONTA, não dele.
  owner_id uuid NOT NULL,
  -- Quem de fato clicou em exportar — pode ser o dono ou um colaborador.
  exported_by uuid NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT now(),
  -- 'pessoas' é o único hoje; texto livre em vez de enum porque não há
  -- nenhuma outra exportação na plataforma para validar contra.
  kind text NOT NULL DEFAULT 'pessoas',
  formato text NOT NULL,
  row_count integer NOT NULL
);

ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY export_logs_select ON public.export_logs
  FOR SELECT
  USING (owner_id = public.acting_account());

CREATE POLICY export_logs_insert ON public.export_logs
  FOR INSERT
  WITH CHECK (owner_id = public.acting_account() AND exported_by = auth.uid());
