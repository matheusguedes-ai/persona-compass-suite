import { useNavigate } from "@tanstack/react-router";
import { Search, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/role-context";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/lib/theme";
import { VerComoAluno } from "@/components/ver-como-aluno";
import { Sino } from "@/components/sino";

export function AppHeader({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  const user = useCurrentUser();
  const nav = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", search: { next: "" }, replace: true });
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-black/5 bg-background/80 px-4 backdrop-blur-md sm:px-8">
      <div className="flex min-w-0 items-center gap-2">
        {/* #279 F1 — só existe abaixo de lg: ali a barra fixa (AppSidebar)
            já cobre a navegação. */}
        <button
          onClick={onAbrirMenu}
          className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
          title="Abrir menu"
        >
          <Menu className="size-4" />
        </button>
        {/* Decorativa por enquanto (sem busca real ainda) — escondida abaixo
            de lg para não competir por espaço com o e-mail e os botões do
            lado direito num celular. */}
        <div className="hidden w-96 items-center gap-2 rounded-md bg-muted px-3 py-1.5 ring-1 ring-black/5 lg:flex">
          <Search className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Pesquisar avaliados ou instrumentos...
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {user && (
          <span className="hidden truncate text-xs text-muted-foreground sm:inline sm:max-w-[220px]">{user.email ?? user.displayName}</span>
        )}
        <Sino />
        <ThemeToggle />
        <VerComoAluno />
        <Button variant="outline" size="sm" onClick={signOut} title="Sair">
          <LogOut className="size-4" /> <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}