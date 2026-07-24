import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { INSTRUMENTS } from "@/lib/mock-data";

export default defineTool({
  name: "list_instruments",
  title: "Listar instrumentos de avaliação",
  description:
    "Retorna o catálogo de testes disponíveis na plataforma (DISC, Big Five, MBTI, Temperamentos, VAK, QI, etc.), com categoria e duração estimada.",
  inputSchema: {
    category: z
      .enum(["comportamental", "psicometrico", "cognitivo"])
      .optional()
      .describe("Filtra o catálogo por categoria do instrumento."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category }) => {
    const items = category
      ? INSTRUMENTS.filter((i) => i.category === category)
      : INSTRUMENTS;
    const rows = items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      duration_min: i.durationMin,
      description: i.description,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { instruments: rows },
    };
  },
});