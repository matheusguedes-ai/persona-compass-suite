/**
 * Assina, para quem acabou de enviar, o link de pré-visualização do PRÓPRIO
 * arquivo — usado logo após o upload de avatar, capa de material/pasta e
 * banner, antes de salvar o formulário.
 *
 * Existe porque fechar os buckets tira do navegador qualquer jeito de assinar
 * por conta própria (migração
 * `20260731050000_storage_biblioteca_avatares_so_service_role_assina.sql`) —
 * sem isto, o preview ao vivo quebraria no instante em que a pessoa termina
 * de enviar o arquivo, antes mesmo de salvar.
 *
 * A checagem de dono é o próprio CAMINHO: os três componentes que usam isto
 * (avatar, biblioteca, banner) sempre gravam em `${meu_user_id}/...` — então
 * só assina se o primeiro pedaço do caminho for de quem está pedindo. Não
 * abre nada além do arquivo que a pessoa acabou de mandar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assinarUrl, partirUrl, TTL_ARQUIVO_SEGUNDOS } from "@/lib/storage-assinado.server";

export const assinarMeuEnvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // #282 — recebe o identificador interno (bucket/caminho), não mais uma URL:
  // `z.string().url()` rejeitaria isso na cara. Quem garante que é algo do
  // nosso storage (e não texto qualquer) é `partirUrl` logo abaixo, e quem
  // garante que é do PRÓPRIO dono é a checagem de `dono` na sequência — a
  // validação de formato aqui não precisa fazer esse trabalho de novo.
  .inputValidator((d) => z.object({ url: z.string().trim().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const alvo = partirUrl(data.url);
    const dono = alvo?.caminho.split("/")[0];
    if (!alvo || dono !== context.userId) {
      throw new Error("Só dá para pré-visualizar um arquivo que você mesmo enviou.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const assinada = await assinarUrl(supabaseAdmin, data.url, TTL_ARQUIVO_SEGUNDOS);
    if (!assinada) throw new Error("Não consegui gerar a pré-visualização.");
    return { url: assinada };
  });
