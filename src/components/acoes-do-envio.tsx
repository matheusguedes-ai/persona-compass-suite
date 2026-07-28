/**
 * Cancelar e excluir um envio.
 *
 * São coisas diferentes e a tela precisa deixar isso claro:
 * - **Cancelar** derruba o link e mantém o registro. Reversível. É o que se
 *   quer quase sempre: mandou para a pessoa errada, adiou a aplicação.
 * - **Excluir** apaga tudo, inclusive as respostas e o relatório. Sem volta.
 *
 * Por isso "Excluir" fica atrás de um menu e, quando já foi respondido, o aviso
 * diz exatamente o que se perde.
 */
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Ban, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";

export function AcoesDoEnvio({
  nome, respondido, cancelado, bateria, onCancelar, onExcluir, ocupado,
}: {
  nome: string;
  respondido: boolean;
  cancelado: boolean;
  bateria?: boolean;
  onCancelar: (cancelar: boolean) => void;
  onExcluir: () => void;
  ocupado?: boolean;
}) {
  const oQue = bateria ? "esta bateria" : "este envio";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={ocupado} aria-label="Mais ações">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {cancelado ? (
          <DropdownMenuItem onClick={() => onCancelar(false)}>
            <RotateCcw className="size-4" />
            <span>Reativar o link</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onCancelar(true)} disabled={respondido}>
            <Ban className="size-4" />
            <div className="flex flex-col">
              <span>Cancelar</span>
              <span className="text-[11px] text-muted-foreground">
                {respondido ? "já foi respondido" : "o link para de funcionar"}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <Trash2 className="size-4" />
              <div className="flex flex-col">
                <span>Excluir</span>
                <span className="text-[11px] text-muted-foreground">apaga o registro</span>
              </div>
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {oQue} de {nome}?</AlertDialogTitle>
              <AlertDialogDescription>
                {respondido ? (
                  <>
                    Atenção: {oQue} <strong>já foi respondido</strong>. Excluir apaga também as respostas
                    e o relatório — não dá para recuperar depois.
                    <br />
                    <br />
                    Se você só quer que o link pare de funcionar, feche isto e use{" "}
                    <strong>Cancelar</strong>: o histórico continua de pé.
                  </>
                ) : (
                  <>
                    O registro some da lista e o link deixa de existir. Como ainda não foi respondido,
                    não há resultado a perder.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onExcluir}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
