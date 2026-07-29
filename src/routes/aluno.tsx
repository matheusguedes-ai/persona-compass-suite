import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/team.functions";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { ArrowLeft, Eye, GraduationCap, LayoutList, LogOut, UserRound , MessagesSquare, Users, Trophy, FolderKanban} from "lucide-react";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/aluno")({
  ssr: false,
  // `ver` = id do avaliado que o mentor está pré-visualizando.
  validateSearch: (s: Record<string, unknown>) => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
  }),
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
  { to: "/aluno/comunidade", label: "Comunidade", icon: Users, exato: false },
  { to: "/aluno/ranking", label: "Ranking", icon: Trophy, exato: false },
  { to: "/aluno/devolutivas", label: "Devolutivas", icon: MessagesSquare, exato: false },
  { to: "/aluno/educacao", label: "Educação", icon: GraduationCap, exato: false },
  { to: "/aluno/perfil", label: "Meu perfil", icon: UserRound, exato: false },
] as const;

function AlunoLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { ver } = Route.useSearch();
  // O mentor é um avaliado promovido: mesmo painel, com Grupos a mais. Era o
  // desenho que faltava — antes ele tinha um cadastro à parte e caía no painel
  // do dono, vazio.
  const membershipFn = useServerFn(getMyMembership);
  const { data: membership } = useQuery({
    queryKey: ["my-membership"], queryFn: () => membershipFn(), staleTime: 300_000,
  });
  const itens =
    membership?.kind === "mentor"
      ? [...NAV, { to: "/aluno/grupos", label: "Grupos", icon: FolderKanban, exato: false } as const]
      : NAV;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground" style={{ fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="border-b border-black/5 bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-4">
          <BrandMark />
          <nav className="flex gap-1">
            {itens.map((n) => {
              const ativo = n.exato ? pathname === n.to : pathname.startsWith(n.to);
              const Icone = n.icon;
              return (
                <Link
                  key={n.to} to={n.to} search={{ ver }}
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
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {!ver && (
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-3.5" /> Sair
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Deixa explícito que não é a conta de quem está olhando. */}
      {ver && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-6 py-2.5 text-sm text-amber-900">
            <Eye className="size-4 shrink-0" />
            <span>
              Você está vendo a plataforma <strong>como o aluno vê</strong>. É só visualização — nada
              que você fizer aqui é salvo no lugar dele.
            </span>
            <a href="/pessoas" className="ml-auto flex items-center gap-1 font-medium hover:underline">
              <ArrowLeft className="size-3.5" /> Voltar ao meu painel
            </a>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
      <Toaster position="top-right" />
    </div>
  );
}
