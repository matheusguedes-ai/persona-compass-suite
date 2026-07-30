import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/team.functions";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Eye, GraduationCap, LayoutList, LogOut, UserRound, MessagesSquare,
  Users, Trophy, FolderKanban, CalendarDays, PanelLeftClose, PanelLeft, Menu,
  Presentation,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/lib/theme";
import { Sino } from "@/components/sino";
import { SeloDaConta } from "@/components/selo-da-conta";

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
  { to: "/aluno/devolutivas", label: "Devolutivas", icon: MessagesSquare, exato: false },
  { to: "/aluno/agenda", label: "Agenda", icon: CalendarDays, exato: false },
  { to: "/aluno/educacao", label: "Academy", icon: GraduationCap, exato: false },
  { to: "/aluno/classroom", label: "Classroom", icon: Presentation, exato: false },
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
      ? [
          ...NAV,
          { to: "/aluno/grupos", label: "Grupos", icon: FolderKanban, exato: false } as const,
        ]
      : NAV;

  // Recolhida ou não — a escolha é dele e fica salva no navegador. Quem recolhe
  // não quer recolher de novo a cada visita.
  const [recolhida, setRecolhida] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  useEffect(() => {
    setRecolhida(localStorage.getItem("aluno-menu-recolhido") === "1");
  }, []);
  function alternar() {
    setRecolhida((v) => {
      localStorage.setItem("aluno-menu-recolhido", v ? "0" : "1");
      return !v;
    });
  }

  const larguraMenu = recolhida ? "lg:w-16" : "lg:w-60";
  const margemConteudo = recolhida ? "lg:pl-16" : "lg:pl-60";

  const navegacao = (
    <nav className="flex-1 space-y-1 px-2">
      {itens.map((n) => {
        const ativo = n.exato ? pathname === n.to : pathname.startsWith(n.to);
        const Icone = n.icon;
        return (
          <Link
            key={n.to} to={n.to} search={{ ver }}
            onClick={() => setMenuAberto(false)}
            title={recolhida ? n.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              recolhida && "lg:justify-center lg:px-0",
              ativo
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icone className="size-4 shrink-0" />
            {/* Recolhida, some o rótulo — mas só no desktop. No celular a barra
                é uma gaveta, e lá o texto sempre aparece. */}
            <span className={cn(recolhida && "lg:hidden")}>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background font-sans text-foreground" style={{ fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif" }}>
      {/* ------------------------------------------------ BARRA LATERAL --- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-black/5 bg-card transition-[width] lg:flex",
          larguraMenu,
        )}
      >
        <div className={cn("flex h-16 items-center px-4", recolhida && "justify-center px-0")}>
          {!recolhida && <BrandMark />}
        </div>
        {navegacao}
        <button
          onClick={alternar}
          className={cn(
            "m-2 flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted",
            recolhida && "justify-center px-0",
          )}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
        >
          {recolhida ? <PanelLeft className="size-4" /> : <><PanelLeftClose className="size-4" /> Recolher</>}
        </button>
      </aside>

      {/* Gaveta do celular: a barra fixa comeria a tela inteira. */}
      {menuAberto && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenuAberto(false)} />
          <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-black/5 bg-card lg:hidden">
            <div className="flex h-16 items-center px-4"><BrandMark /></div>
            {navegacao}
          </aside>
        </>
      )}

      <div className={cn("transition-[padding]", margemConteudo)}>
        <header className="border-b border-black/5 bg-card">
          <div className="flex items-center gap-3 px-6 py-4">
            <button
              onClick={() => setMenuAberto(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
              title="Abrir menu"
            >
              <Menu className="size-4" />
            </button>
            <div className="lg:hidden"><BrandMark /></div>
            <div className="ml-auto flex items-center gap-2">
              {!ver && <Sino area="aluno" />}
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
            <div className="flex flex-wrap items-center gap-3 px-6 py-2.5 text-sm text-amber-900">
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
        <SeloDaConta />
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
