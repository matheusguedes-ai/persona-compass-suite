/**
 * Exportar o cadastro das pessoas.
 *
 * SÓ CADASTRO — decisão do Matheus. Nada de resultado de teste, resposta ou
 * mentoria. Isso derruba quase todo o risco do arquivo: uma planilha com nome
 * e telefone é dado comum de RH; a mesma planilha com perfil comportamental de
 * 200 pessoas seria outra coisa.
 *
 * A montagem é no SERVIDOR, e não no navegador a partir da lista já carregada.
 * A tela de Pessoas é paginada: exportar o que está na tela exportaria só a
 * primeira página, e ninguém perceberia até faltar gente no arquivo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/lib/permissao.server";

export const dadosParaExportar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      // Vazio = todas as que a pessoa pode ver. A RLS decide, não o pedido.
      ids: z.array(z.string().uuid()).optional(),
      // Só para o rastro (demanda #21) — não muda o que é buscado.
      formato: z.enum(["xlsx", "pdf"]),
    }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await exigirPermissao(context.supabase, context.userId, "pessoas");
    const supabase = context.supabase;

    let q = supabase
      .from("people")
      .select("id, full_name, email, phone, role, profession, role_at_company, created_at")
      .order("full_name");
    if (data.ids?.length) q = q.in("id", data.ids);
    const { data: pessoas, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (pessoas ?? []).map((p) => p.id);
    const { data: vinculos } = ids.length
      ? await supabase.from("group_members").select("person_id, groups(name)").in("person_id", ids)
      : { data: [] as Array<{ person_id: string; groups: { name: string } | null }> };

    const linhas = (pessoas ?? []).map((p) => ({
      Nome: p.full_name ?? "",
      "E-mail": p.email ?? "",
      Telefone: p.phone ?? "",
      Papel: p.role ?? "",
      Profissão: p.profession ?? "",
      Cargo: p.role_at_company ?? "",
      Grupos: (vinculos ?? [])
        .filter((v) => v.person_id === p.id)
        .map((v) => v.groups?.name)
        .filter(Boolean)
        .join(", "),
      "Cadastrada em": p.created_at
        ? new Date(p.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
        : "",
    }));

    // Quem exportou e quando vai no arquivo. Não impede nada — só deixa rastro
    // de um arquivo que sai da plataforma com dado pessoal dentro.
    const { data: eu } = await supabase.auth.getUser();

    // De qual CONTA são os dados — não necessariamente quem clicou. Um
    // colaborador com a permissão `pessoas` exporta dado da conta do dono,
    // não dele; é essa identidade que importa para "a quem o dado pertence".
    const { data: ownerId } = await supabase.rpc("acting_account");
    const { data: perfil } = ownerId
      ? await supabase.from("profiles").select("company_name").eq("user_id", ownerId).maybeSingle()
      : { data: null };

    // Registro que sobrevive ao arquivo em si — se o rodapé for editado ou
    // apagado depois, a conta ainda sabe quem exportou, quando e quantas
    // pessoas. Não bloqueia a exportação se falhar por algum motivo.
    if (ownerId) {
      const { error: erroRastro } = await supabase.from("export_logs").insert({
        owner_id: ownerId,
        exported_by: context.userId,
        kind: "pessoas",
        formato: data.formato,
        row_count: linhas.length,
      });
      if (erroRastro) console.error("Falha ao gravar rastro de exportação:", erroRastro.message);
    }

    return {
      linhas,
      rodape: `Exportado por ${eu.user?.email ?? "—"} em ${new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })} · ${linhas.length} ${linhas.length === 1 ? "pessoa" : "pessoas"}` +
        (perfil?.company_name ? ` — Dados de propriedade de ${perfil.company_name}.` : ""),
    };
  });
