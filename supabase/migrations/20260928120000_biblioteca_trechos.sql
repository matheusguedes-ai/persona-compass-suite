-- #312 — a assistente passa a ler o CONTEÚDO dos materiais da Biblioteca, não só o título.
-- ETAPA ÚNICA, só ADITIVA (regra 5): tabela nova, colunas novas, funções novas. Nada do que está no
-- ar muda de significado — quem nunca ouviu falar de "trecho" continua funcionando exatamente igual.
--
-- O DESENHO:
--   1. Cada PDF vira uma sequência de TRECHOS (~200 palavras cada, com uma sobra do trecho anterior
--      para não cortar uma ideia ao meio) — extraídos e guardados UMA VEZ, no upload (ou no backfill
--      dos que já existem). A pergunta do aluno nunca lê o livro inteiro: só busca os trechos que
--      batem com ela.
--   2. A busca é texto (tsvector em português), não embedding — o acervo é pequeno (9 livros hoje) e
--      isso evita depender de outro provedor além da Anthropic só para indexar.
--   3. A PERMISSÃO NÃO É RECALCULADA AQUI: `bib_buscar_trechos` e `bib_amostra_trechos` filtram por
--      `bib_visiveis()` — a MESMA porta que decide o que aparece na tela e na assistente hoje. Se um
--      material está bloqueado ou fora do menu para quem pergunta, os trechos dele nunca entram no
--      resultado — nem para dizer que existem.
--   4. `biblioteca_material_trechos` NÃO tem policy nenhuma para `authenticated`: ninguém lê o texto
--      extraído direto pela API, só através das duas funções acima (SECURITY DEFINER, que filtram por
--      permissão antes de devolver uma linha). Isso fecha um caminho que a #313 não precisou fechar
--      (ela nunca guardou o CONTEÚDO do arquivo no banco, só metadado) — texto de livro inteiro dá para
--      reconstruir um PDF se alguém conseguir listar a tabela crua.

-- ============================================================================ 1. status de indexação
ALTER TABLE public.biblioteca_materiais
  ADD COLUMN IF NOT EXISTS indexacao_status text NOT NULL DEFAULT 'pendente'
    CHECK (indexacao_status IN ('pendente', 'pronto', 'erro', 'nao_aplicavel')),
  ADD COLUMN IF NOT EXISTS indexacao_erro text,
  ADD COLUMN IF NOT EXISTS indexado_em timestamptz,
  ADD COLUMN IF NOT EXISTS paginas integer,
  ADD COLUMN IF NOT EXISTS trechos_count integer;

COMMENT ON COLUMN public.biblioteca_materiais.indexacao_status IS
  '#312: pendente (kind=pdf, ainda não processado) · pronto · erro (ver indexacao_erro) · nao_aplicavel (não é PDF — link, vídeo etc). A extração roda dentro de salvarMaterial, então na prática não fica muito tempo em "pendente".';

-- ============================================================================ 2. os trechos
CREATE TABLE IF NOT EXISTS public.biblioteca_material_trechos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Preenchido pelo código da extração a partir de biblioteca_materiais.mentor_id — quem grava aqui é
  -- sempre o servidor (chave de serviço), nunca o navegador, então não precisa de gatilho de conferência
  -- como biblioteca_menu_grupos (aquela tabela recebe id de grupo/pessoa vindos do cliente; esta não
  -- recebe entrada nenhuma do cliente).
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.biblioteca_materiais(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  pagina_inicio integer,
  pagina_fim integer,
  conteudo text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', conteudo)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, ordem)
);
CREATE INDEX IF NOT EXISTS bib_trechos_tsv_idx ON public.biblioteca_material_trechos USING GIN (tsv);
CREATE INDEX IF NOT EXISTS bib_trechos_material_idx ON public.biblioteca_material_trechos (material_id, ordem);

COMMENT ON TABLE public.biblioteca_material_trechos IS
  '#312: o texto do PDF, em pedaços. Reprocessar um material apaga e regrava os trechos dele (ON DELETE CASCADE cobre a exclusão do material). Sem policy para authenticated — só bib_buscar_trechos/bib_amostra_trechos leem, e as duas conferem bib_visiveis antes.';

ALTER TABLE public.biblioteca_material_trechos ENABLE ROW LEVEL SECURITY;

-- ============================================================================ 3. as duas portas de busca
-- Por tema — a pergunta vira um OR entre as palavras significativas dela (recall antes de precisão:
-- com 9 livros, é pior a busca não achar nada do que trazer um trecho a mais de baixa relevância — o
-- ts_rank ordena, e quem decide o que importa é o modelo, lendo o trecho).
CREATE OR REPLACE FUNCTION public.bib_buscar_trechos(_query text, _material_id uuid DEFAULT NULL, _limite integer DEFAULT 6)
RETURNS TABLE(material_id uuid, titulo text, ordem integer, conteudo text, pagina_inicio integer, pagina_fim integer, relevancia real)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_termos text;
  v_tsquery tsquery;
BEGIN
  SELECT string_agg(DISTINCT lexeme, ' | ') INTO v_termos
    FROM unnest(to_tsvector('portuguese', coalesce(_query, ''))) AS t(lexeme, positions, weights);
  IF v_termos IS NULL OR length(trim(v_termos)) = 0 THEN
    RETURN;  -- pergunta sem palavra significativa (só stopword, ou vazia) — nada para buscar
  END IF;
  v_tsquery := to_tsquery('portuguese', v_termos);

  RETURN QUERY
    SELECT t.material_id, m.titulo, t.ordem, t.conteudo, t.pagina_inicio, t.pagina_fim,
           ts_rank(t.tsv, v_tsquery) AS relevancia
      FROM public.biblioteca_material_trechos t
      JOIN public.biblioteca_materiais m ON m.id = t.material_id
     WHERE t.tsv @@ v_tsquery
       AND t.material_id IN (SELECT v.id FROM public.bib_visiveis() v WHERE v.tipo = 'material')
       AND (_material_id IS NULL OR t.material_id = _material_id)
     ORDER BY relevancia DESC, t.ordem
     LIMIT greatest(1, least(coalesce(_limite, 6), 20));
END;
$fn$;

-- Para "resuma o livro inteiro": não é busca por tema, é uma amostra espalhada pelo livro todo — senão
-- o resumo sairia só da parte que bateu com a pergunta.
CREATE OR REPLACE FUNCTION public.bib_amostra_trechos(_material_id uuid, _limite integer DEFAULT 12)
RETURNS TABLE(material_id uuid, titulo text, ordem integer, conteudo text, pagina_inicio integer, pagina_fim integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_limite integer := greatest(1, least(coalesce(_limite, 12), 20));
BEGIN
  IF _material_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.bib_visiveis() v WHERE v.tipo = 'material' AND v.id = _material_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    WITH numerados AS (
      SELECT t.*, row_number() OVER (ORDER BY t.ordem) AS rn, count(*) OVER () AS total
        FROM public.biblioteca_material_trechos t
       WHERE t.material_id = _material_id
    )
    SELECT n.material_id, m.titulo, n.ordem, n.conteudo, n.pagina_inicio, n.pagina_fim
      FROM numerados n
      JOIN public.biblioteca_materiais m ON m.id = n.material_id
     WHERE n.total <= v_limite OR (n.rn - 1) % greatest(1, n.total / v_limite) = 0
     ORDER BY n.ordem
     LIMIT v_limite;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.bib_buscar_trechos(text, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_amostra_trechos(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bib_buscar_trechos(text, uuid, integer) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_amostra_trechos(uuid, integer) TO authenticated, service_role, postgres;

COMMENT ON FUNCTION public.bib_buscar_trechos(text, uuid, integer) IS
  '#312: trechos que batem com _query, só dos materiais que bib_visiveis() devolve para quem chama (aluno: só o dele; dono/equipe: tudo da conta). Chamada com a sessão de quem pergunta — nunca chave de serviço.';
COMMENT ON FUNCTION public.bib_amostra_trechos(uuid, integer) IS
  '#312: amostra espalhada pelos trechos de UM material (para resumo do livro inteiro), com a mesma checagem de bib_visiveis().';
