import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { GraduationCap, LayoutList, LogOut } from "lucide-react";

export const Route = createFileRoute("/aluno")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = `${window.location.pathname}${window.location.search}`;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  component: AlunoLayout,
});

const NAV = [
  { to: "/aluno", label: "Meus resultados", icon: LayoutList, exato: true },
  { to: "/aluno/educacao", label: "Educação", icon: GraduationCap, exato: false },
] as const;

function AlunoLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background font-sans text-foreground" style={{ fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="border-b border-black/5 bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-4">
          <BrandMark />
          <nav className="flex gap-1">
            {NAV.map((n) => {
              const ativo = n.exato ? pathname === n.to : pathname.startsWith(n.to);
              const Icone = n.icon;
              return (
                <Link
                  key={n.to} to={n.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition",
                    ativo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icone className="size-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" /> Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
      <Toaster position="top-right" />
    </div>
  );
}
