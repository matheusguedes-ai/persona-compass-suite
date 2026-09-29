-- #320 — a assistente não sabia RESUMIR um livro da Biblioteca, só buscar trechos por tema (#312).
--
-- A CAUSA: #312 só guarda o livro em pedaços de ~200 palavras, buscados por palavra-chave. Pedir
-- "resuma o livro" caía em `bib_amostra_trechos` — uma amostra espalhada pelo livro, honesta sobre
-- ser parcial, mas nunca um resumo de verdade (ela não lê o livro inteiro de uma vez, só devolve
-- pedaços soltos para o modelo tentar costurar). Pergunta de TEMA ("onde o Goleman fala sobre
-- empatia?") continua servida por busca de trechos — isso já funciona e não muda.
--
-- A SOLUÇÃO: gerar e guardar um resumo de verdade UMA VEZ, no momento da indexação (quando o texto
-- inteiro do PDF está disponível), e servir esse resumo pronto para pedido de resumo — nunca
-- recalculado a cada pergunta. `src/lib/biblioteca-resumo.server.ts` faz a conta (mapa-e-junção para
-- livro grande demais para uma chamada só); esta migração só guarda o resultado e decide quem pode
-- LER.
--
-- ETAPA ÚNICA, só ADITIVA (regra 5): colunas novas e funções novas. Nada do que está no ar muda de
-- significado.
--
-- DONO: já é `biblioteca_materiais.mentor_id` — o resumo é só mais um dado do material, mesma conta,
-- nunca vaza de uma conta para outra (multi-tenant futuro plugando sem cirurgia extra, regra 2).
--
-- PERMISSÃO: a MESMA porta de sempre. `bib_resumo_material` só devolve linha para quem `bib_visiveis()`
-- já deixaria ver o material — pela mesma regra de `bib_amostra_trechos`/`bib_buscar_trechos`. Livro
-- sem acesso não aparece nem para dizer que existe.

-- ============================================================================ 1. status do resumo
ALTER TABLE public.biblioteca_materiais
  ADD COLUMN IF NOT EXISTS resumo text,
  ADD COLUMN IF NOT EXISTS resumo_status text NOT NULL DEFAULT 'pendente'
    CHECK (resumo_status IN ('pendente', 'pronto', 'erro', 'nao_aplicavel')),
  ADD COLUMN IF NOT EXISTS resumo_erro text,
  ADD COLUMN IF NOT EXISTS resumo_gerado_em timestamptz;

COMMENT ON COLUMN public.biblioteca_materiais.resumo IS
  '#320: resumo do livro inteiro, gerado uma vez (map-reduce quando o livro não cabe numa chamada só), em português, sempre com palavras próprias — nunca colagem de trechos. Servido verbatim para pedido de resumo; pergunta de tema continua na busca por trecho (#312).';
COMMENT ON COLUMN public.biblioteca_materiais.resumo_status IS
  '#320: pendente (kind=pdf, indexado mas resumo ainda não gerado) · pronto · erro (ver resumo_erro) · nao_aplicavel (não é PDF). Enquanto não fica "pronto", a assistente diz que o resumo ainda está sendo preparado — nunca finge ter lido o livro com uma amostra de trechos.';

-- ============================================================================ 2. a porta de leitura
CREATE OR REPLACE FUNCTION public.bib_resumo_material(_material_id uuid)
RETURNS TABLE (titulo text, resumo text, resumo_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT m.titulo, m.resumo, m.resumo_status
    FROM public.biblioteca_materiais m
   WHERE m.id = _material_id
     AND EXISTS (SELECT 1 FROM public.bib_visiveis() v WHERE v.tipo = 'material' AND v.id = _material_id);
$fn$;

COMMENT ON FUNCTION public.bib_resumo_material(uuid) IS
  '#320: o resumo (e o status dele) de UM material, só se bib_visiveis() deixaria quem chama ver esse material. Sem linha nenhuma = material não existe ou está fora do alcance de quem pergunta — a assistente não aprende a diferença.';
