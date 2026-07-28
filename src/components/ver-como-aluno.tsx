/**
 * "Ver como aluno": abre a área do avaliado com os dados de uma pessoa da conta.
 *
 * Não é personificação de login — o mentor já enxerga esses dados no painel
 * dele. O que muda aqui é a **apresentação**: ele vê a mesma informação na tela
 * que o aluno usa, para conferir como fica antes de enviar.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPeople } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Eye, Search, UserRound } from "lucide-react";

type Pessoa = { id: string; full_name: string; email: string };

export function VerComoAluno() {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const listFn = useServerFn(listPeople);
  const { data: pessoas = [], isLoading } = useQuery({
    queryKey: ["people"],
    queryFn: () => listFn(),
    enabled: aberto,
  });

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const rows = pessoas as Pessoa[];
    if (!q) return rows.slice(0, 50);
    return rows
      .filter((p) => p.full_name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [pessoas, busca]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Abrir a plataforma como o avaliado enxerga">
          <Eye className="size-4" /> Ver como aluno
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Ver como aluno</DialogTitle>
          <DialogDescription>
            Escolha um avaliado para abrir a plataforma do jeito que ele vê — os testes dele e as
            trilhas liberadas. É só visualização: nada é salvo no lugar dele.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9" placeholder="Buscar por nome ou email" autoFocus
            value={busca} onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="-mx-1 max-h-80 overflow-y-auto px-1">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {pessoas.length === 0
                ? "Você ainda não tem avaliados cadastrados."
                : "Ninguém encontrado com esse nome ou email."}
            </p>
          ) : (
            <ul className="space-y-1">
              {lista.map((p) => (
                <li key={p.id}>
                  {/* Link "de verdade" (não navegação do roteador) para a área do
                      aluno abrir limpa, com o próprio layout dela. */}
                  <a
                    href={`/aluno?ver=${p.id}`}
                    className="flex items-center gap-3 rounded-lg border border-black/5 p-3 text-sm hover:bg-muted/40"
                  >
                    <UserRound className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                    </span>
                    <Eye className="size-4 shrink-0 text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
