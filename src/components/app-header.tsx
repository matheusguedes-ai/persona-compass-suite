import { Link } from "@tanstack/react-router";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRole, ROLE_LABEL, type UserRole } from "@/lib/role-context";

export function AppHeader() {
  const { role, setRole } = useRole();
  const isAvaliado = role === "avaliado";

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-black/5 bg-background/80 px-8 backdrop-blur-md">
      <div className="flex w-96 items-center gap-2 rounded-md bg-muted px-3 py-1.5 ring-1 ring-black/5">
        <Search className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {isAvaliado ? "Buscar meus testes..." : "Pesquisar avaliados ou instrumentos..."}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              Perfil: {ROLE_LABEL[role]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Alternar perfil (demo)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["admin", "coach", "avaliado"] as UserRole[]).map((r) => (
              <DropdownMenuItem key={r} onClick={() => setRole(r)}>
                {ROLE_LABEL[r]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {!isAvaliado && (
          <Button asChild size="sm">
            <Link to="/envios/novo">
              <Plus className="size-4" /> Novo Envio
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}