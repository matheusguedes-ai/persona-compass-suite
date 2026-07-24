import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listInstrumentsTool from "./tools/list-instruments";
import whoamiTool from "./tools/whoami";

// The OAuth issuer MUST be the direct Supabase host. On publish, SUPABASE_URL
// is rewritten to the `.lovable.cloud` proxy which mcp-js rejects (RFC 8414
// issuer mismatch). The project ref survives publish unchanged and Vite inlines
// VITE_SUPABASE_PROJECT_ID as a literal at build time.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "metrica-humana-mcp",
  title: "Métrica Humana",
  version: "0.1.0",
  instructions:
    "Ferramentas para a plataforma de assessments Métrica Humana. Use `whoami` para confirmar a conexão OAuth e `list_instruments` para descobrir os testes disponíveis (DISC, Big Five, MBTI, Temperamentos, VAK, QI, etc.).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listInstrumentsTool],
});