import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

/**
 * O catálogo de testes, lido do BANCO.
 *
 * Isto servia `INSTRUMENTS` de `src/lib/mock-data.ts` — a lista de exemplo que
 * nasceu com o protótipo. Quem consultasse a plataforma pela integração recebia
 * o catálogo congelado no dia em que aquele arquivo foi escrito: sem o teste de
 * Valores (criado depois), com descrições que não conferem com as do banco, e
 * sem enxergar nenhum instrumento novo daqui para a frente.
 *
 * A tabela `instruments` é o catálogo de verdade, e ela é pública por natureza —
 * nome de teste, categoria e duração não são de ninguém. Daí a leitura pela
 * chave anônima: não há usuário nesta chamada, e não deve haver.
 */
export default defineTool({
  name: "list_instruments",
  title: "Listar instrumentos de avaliação",
  description:
    "Retorna o catálogo de testes disponíveis na plataforma (DISC, Big Five, MBTI, Valores, Temperamentos, VAK, QI), com categoria e duração estimada. Lido do banco, não de uma lista fixa.",
  inputSchema: {
    category: z
      .enum(["comportamental", "psicometrico", "cognitivo"])
      .optional()
      .describe("Filtra o catálogo por categoria do instrumento."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    let q = supabase
      .from("instruments")
      .select("id, name, category, duration_min, description")
      .order("name");
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    // Erro devolvido como erro, e não como catálogo vazio: "a plataforma não
    // tem teste nenhum" é uma resposta muito pior do que "não consegui ler".
    if (error) throw new Error(`Não consegui ler o catálogo: ${error.message}`);

    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { instruments: rows },
    };
  },
});
