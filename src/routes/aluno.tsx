import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/team.functions";
import { minhasAreas } from "@/lib/data.functions";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Eye, GraduationCap, LayoutList, Lock, LogOut, UserRound, MessagesSquare,
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

// `area` liga o item à permissão do grupo (`groups.areas_aluno`). Sem `area` o
// item é fixo: "Meu perfil" é onde ele troca a própria senha e os próprios
// dados, e tirá-lo prenderia a pessoa numa conta que ela não consegue ajustar.
const NAV = [
  { to: "/aluno", label: "Meus resultados", icon: LayoutList, exato: true, area: "resultados" },
  { to: "/aluno/comunidade", label: "Comunidade", icon: Users, exato: false, area: "comunidade" },
  { to: "/aluno/mentorias", label: "Mentorias", icon: MessagesSquare, exato: false, area: "mentorias" },
  { to: "/aluno/agenda", label: "Agenda", icon: CalendarDays, exato: false, area: "agenda" },
  { to: "/aluno/educacao", label: "Academy", icon: GraduationCap, exato: false, area: "academy" },
  { to: "/aluno/classroom", label: "Classroom", icon: Presentation, exato: false, area: "classroom" },
  { to: "/aluno/perfil", label: "Meu perfil", icon: UserRound, exato: false, area: null },
] as const;

// O ranking mora dentro da comunidade e não tem item próprio no menu; a rota
// existe e precisa seguir a mesma permissão.
const AREA_EXTRA: Record<string, string> = { "/aluno/ranking": "comunidade" };

/** A área da rota aberta agora — para a página inteira parar, não só o menu. */
function areaDaRota(pathname: string): string | null {
  if (AREA_EXTRA[pathname]) return AREA_EXTRA[pathname];
  const item = [...NAV]
    .filter((n) => (n.exato ? pathname === n.to : pathname.startsWith(n.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return item?.area ?? null;
}

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

  // O que o grupo dele libera. Enquanto não chega, mostro o menu inteiro: um
  // menu que aparece pela metade e depois completa pisca a cada navegação.
  const areasFn = useServerFn(minhasAreas);
  const { data: acesso } = useQuery({
    queryKey: ["minhas-areas", ver ?? null],
    queryFn: () => areasFn({ data: { preview_person_id: ver ?? null } }),
    staleTime: 60_000,
  });
  const liberada = (area: string | null) =>
    area === null || !acesso || acesso.areas.includes(area);

  const base = NAV.filter((n) => liberada(n.area));
  const itens =
    membership?.kind === "mentor"
      ? [
          ...base,
          { to: "/aluno/grupos", label: "Grupos", icon: FolderKanban, exato: false, area: null } as const,
        ]
      : base;

  const areaAtual = areaDaRota(pathname);
  const bloqueada = !liberada(areaAtual);

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
              {/* O caminho de volta de quem tem conta própria E é avaliado em
                  outra. O aviso âmbar logo abaixo só aparece na PRÉVIA (`ver`);
                  quem vem aqui como aluno de verdade ficava sem saída a não ser
                  o botão do navegador. Nunca para aluno puro: ele não tem
                  painel de mentor para onde voltar. */}
              {!ver && membership?.tambem_avaliado && membership.kind !== "mentor" && (
                <Link
                  to="/"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" /> Meu painel
                </Link>
              )}
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
          {/* Esconder só o item do menu deixaria a rota respondendo a quem
              digitasse o endereço. O banco também barra (aluno_pode); esta tela
              existe para dizer o motivo em vez de mostrar uma página vazia. */}
          {bloqueada ? (
            <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
              <Lock className="mx-auto size-8 text-muted-foreground" />
              <h1 className="mt-4 text-base font-medium">Esta área não faz parte do seu acesso</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {ver
                  ? "Esta pessoa não tem acesso a esta área. Isso vem do grupo dela — ajuste em Grupos, na aba Acesso."
                  : "Seu programa não inclui esta parte da plataforma. Se achar que deveria incluir, fale com o seu mentor."}
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        <SeloDaConta />
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
