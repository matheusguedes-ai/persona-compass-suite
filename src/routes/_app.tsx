import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = `${window.location.pathname}${window.location.search}`;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
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
  );
}