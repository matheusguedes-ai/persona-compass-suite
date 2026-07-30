import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";
import { SeloDaConta } from "@/components/selo-da-conta";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";
import { BrandProvider } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { getMyMembership } from "@/lib/team.functions";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = `${window.location.pathname}${window.location.search}`;
      throw redirect({ to: "/auth", search: { next } });
    }
    // Avaliado que criou login não tem o que fazer no painel do mentor: veria
    // tudo vazio. Mandamos direto para a área dele.
    //
    // ⚠️ O teste de "isto é um redirect?" precisa ser `isRedirect`, do próprio
    // roteador. Antes era `"to" in e` — e o objeto de redirect do TanStack é
    // `Response & { options: { to } }`, com o `to` UM NÍVEL ABAIXO. O teste
    // dava sempre falso, o catch engolia o próprio redirect, e o aluno ficava
    // no painel do mentor: via "Novo Envio", "Ver como aluno" e um "Ranking
    // geral" que não é dele. Só apareceu quando um aluno de verdade entrou.
    try {
      const eu = await getMyMembership();
      if (eu.kind === "aluno") throw redirect({ to: "/aluno", search: { ver: undefined } });
    } catch (e) {
      if (isRedirect(e)) throw e;
      // Não deu para saber quem é. O painel do mentor é o lado ERRADO de errar
      // — ele mostra a operação da conta. Na dúvida, manda para a área do
      // aluno, que é inofensiva para quem não é aluno (o menu dela é dele).
      console.error("[_app] não consegui identificar o papel:", e);
      throw redirect({ to: "/aluno", search: { ver: undefined } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <BrandProvider>
      <div className="min-h-screen bg-background font-sans text-foreground" style={{ fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif' }}>
        <AppSidebar />
        <div className="lg:pl-64">
          <AppHeader />
          <main className="p-8">
            <Outlet />
          </main>
          <SeloDaConta />
        </div>
        <Toaster position="top-right" />
      </div>
    </BrandProvider>
  );
}