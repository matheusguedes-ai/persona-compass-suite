import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  Inbox,
  FolderKanban,
  GraduationCap,
  FlaskConical,
  ChevronDown,
} from "lucide-react";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";
import { INSTRUMENTS } from "@/lib/mock-data";

const ADMIN_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { to: "/grupos", label: "Grupos", icon: FolderKanban },
  { to: "/pessoas", label: "Pessoas", icon: Users },
  { to: "/mentores", label: "Mentores", icon: GraduationCap },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

const AVALIADO_NAV = [
  { to: "/meus-testes", label: "Meus Testes", icon: Inbox },
  { to: "/configuracoes", label: "Meu Perfil", icon: Settings },
] as const;

export function AppSidebar() {
  const { role, displayName } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = role === "avaliado" ? AVALIADO_NAV : ADMIN_NAV;
  const [testesOpen, setTestesOpen] = useState(false);
  const showTestes = role !== "avaliado";

  const ACCENT_DOT: Record<string, string> = {
    rose: "bg-rose-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    teal: "bg-teal-500",
    violet: "bg-violet-500",
    zinc: "bg-zinc-500",
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-black/5 bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-6 rounded bg-primary" />
          <span className="text-sm font-semibold uppercase tracking-tight">
            Métrica Humana
          </span>
        </Link>
      </div>

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active =
            item.to === "/"
              ? pathname === "/"
              : pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          const node = (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
          if (showTestes && item.to === "/grupos") {
            return (
              <div key="grupos-with-testes">
                {node}
                <button
                  type="button"
                  onClick={() => setTestesOpen((v) => !v)}
                  className={cn(
                    "mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                  aria-expanded={testesOpen}
                >
                  <FlaskConical className="size-4 shrink-0" />
                  <span className="flex-1 text-left">Testes</span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 transition-transform",
                      testesOpen && "rotate-180",
                    )}
                  />
                </button>
                {testesOpen && (
                  <ul className="mb-1 mt-1 space-y-0.5 border-l border-black/5 pl-3 ml-5">
                    {INSTRUMENTS.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground"
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full shrink-0",
                            ACCENT_DOT[t.accent] ?? "bg-zinc-400",
                          )}
                        />
                        <span className="truncate">{t.shortName}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }
          return node;
        })}
      </nav>

      <div className="border-t border-black/5 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600 ring-1 ring-black/5">
            {displayName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium">{displayName}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {role === "admin" ? "Administrador" : role === "coach" ? "Master Coach" : "Avaliado"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}