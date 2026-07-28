import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
    try {
      const eu = await getMyMembership();
      if (eu.kind === "aluno") throw redirect({ to: "/aluno", search: { ver: undefined } });
    } catch (e) {
      // `redirect` do roteador é lançado como exceção — não engolir.
      if (e && typeof e === "object" && "to" in e) throw e;
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
        </div>
        <Toaster position="top-right" />
      </div>
    </BrandProvider>
  );
}