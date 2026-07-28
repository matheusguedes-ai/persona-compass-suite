import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Settings,
  Send,
  FolderKanban,
  GraduationCap,
  FlaskConical,
} from "lucide-react";
import { useCurrentUser } from "@/lib/role-context";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/grupos", label: "Grupos", icon: FolderKanban },
  { to: "/pessoas", label: "Pessoas", icon: Users },
  { to: "/mentores", label: "Mentores", icon: GraduationCap },
  { to: "/testes", label: "Testes", icon: FlaskConical },
  { to: "/envios", label: "Envios", icon: Send },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppSidebar() {
  const user = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV;
  const displayName = user?.displayName ?? "—";
  const email = user?.email ?? "";

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
          return (
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
        })}
      </nav>

      <div className="border-t border-black/5 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600 ring-1 ring-black/5">
            {displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium">{displayName}</span>
            <span className="truncate text-[10px] text-muted-foreground">{email}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}