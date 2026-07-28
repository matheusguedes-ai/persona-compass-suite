import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Settings,
  Send,
  FolderKanban,
  GraduationCap,
  FlaskConical,
  UserCog,
  BookOpen,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/team.functions";
import { useCurrentUser } from "@/lib/role-context";
import { BrandMark, useBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

// `perm` = permissão de colaborador que libera o item; `soDono` = item de
// administração da conta. O menu escondido é só conforto: quem barra de
// verdade é a RLS do banco.
const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/grupos", label: "Grupos", icon: FolderKanban, perm: "grupos" },
  { to: "/pessoas", label: "Pessoas", icon: Users, perm: "pessoas" },
  { to: "/mentores", label: "Mentores", icon: GraduationCap, soDono: true },
  { to: "/colaboradores", label: "Colaboradores", icon: UserCog, soDono: true },
  { to: "/educacao", label: "Educação", icon: BookOpen, perm: "educacao" },
  { to: "/testes", label: "Testes", icon: FlaskConical, perm: "testes" },
  { to: "/envios", label: "Envios", icon: Send, perm: "envios" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, perm: "configuracoes" },
] as const;

export function AppSidebar() {
  const user = useCurrentUser();
  const brand = useBrand();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const membershipFn = useServerFn(getMyMembership);
  const { data: membership } = useQuery({
    queryKey: ["my-membership"],
    queryFn: () => membershipFn(),
    staleTime: 300_000,
  });

  // Sem resposta ainda, mostra o menu do dono: é o caso da esmagadora maioria
  // e evita o menu "piscar" itens aparecendo aos poucos.
  const kind = membership?.kind ?? "owner";
  const permissions = membership?.permissions ?? [];
  const items = NAV.filter((item) => {
    if (kind === "owner") return true;
    if ("soDono" in item && item.soDono) return false;
    if (!("perm" in item)) return true;
    return permissions.includes(item.perm);
  });
  const displayName = user?.displayName ?? "—";
  const email = user?.email ?? "";

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-black/5 bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link to="/">
          <BrandMark brand={brand} />
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