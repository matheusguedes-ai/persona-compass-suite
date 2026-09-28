/**
 * #317 — o seletor de nível da assistente (Básica, Smart, Pro): o MESMO na tela do aluno e na do mentor.
 *
 * Com um nível só liberado não há escolha a fazer, e o seletor não aparece. O estado (o nível em uso, a
 * troca lembrada, o acerto pelo nível que respondeu) mora em `hooks/use-nivel-da-assistente.ts`.
 */
import { ChevronDown, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NIVEL, ehCategoria, type Categoria } from "@/lib/assistente/niveis";

export function SeletorDeNivel({
  permitidas,
  atual,
  onEscolher,
  desabilitado,
}: {
  permitidas: Categoria[];
  atual: Categoria | null;
  onEscolher: (c: Categoria) => void;
  desabilitado?: boolean;
}) {
  if (permitidas.length < 2 || !atual) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          disabled={desabilitado}
          aria-label={`Nível da assistente: ${NIVEL[atual].nome}. Trocar`}
        >
          <Gauge className="size-3.5" /> {NIVEL[atual].nome}{" "}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Nível da assistente — vale a partir da próxima pergunta
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={atual}
          onValueChange={(v) => ehCategoria(v) && onEscolher(v)}
        >
          {permitidas.map((c) => (
            <DropdownMenuRadioItem key={c} value={c} className="items-start py-2">
              <span className="block">
                <span className="block text-sm font-medium">{NIVEL[c].nome}</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  {NIVEL[c].explicacao}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
