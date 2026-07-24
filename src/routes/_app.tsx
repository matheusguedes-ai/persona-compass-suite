import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_app")({
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