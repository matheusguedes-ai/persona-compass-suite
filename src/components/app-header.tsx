import { useNavigate } from "@tanstack/react-router";
import { Search, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/role-context";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/lib/theme";
import { VerComoAluno } from "@/components/ver-como-aluno";
import { Sino } from "@/components/sino";

export function AppHeader() {
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
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-black/5 bg-background/80 px-8 backdrop-blur-md">
      <div className="flex w-96 items-center gap-2 rounded-md bg-muted px-3 py-1.5 ring-1 ring-black/5">
        <Search className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Pesquisar avaliados ou instrumentos...
        </span>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-xs text-muted-foreground truncate max-w-[220px]">{user.email ?? user.displayName}</span>
        )}
        <Sino />
        <ThemeToggle />
        <VerComoAluno />
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="size-4" /> Sair
        </Button>
      </div>
    </header>
  );
}