/**
 * Criar um evento e escolher quem vê.
 *
 * Só o master abre isto. O mentor não publica evento para os grupos dele —
 * quem publica novidade na conta é o master, por decisão do Matheus.
 *
 * A data e a hora são montadas AQUI, no navegador, e enviadas em ISO com fuso.
 * Um `datetime-local` devolve "2026-07-30T14:00" sem fuso nenhum; mandar essa
 * string crua faria o servidor (UTC) ler 14:00 como horário de Londres e o
 * evento apareceria às 11h no Brasil.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { criarEvento } from "@/lib/gestao.functions";
import { meusGrupos } from "@/lib/comunidade.functions";
import { listarPessoasParaDevolutiva } from "@/lib/devolutivas.functions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";

export function NovoEvento() {
  const qc = useQueryClient();
  const criar = useServerFn(criarEvento);
  const gruposFn = useServerFn(meusGrupos);
  const pessoasFn = useServerFn(listarPessoasParaDevolutiva);

  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quando, setQuando] = useState("");
  const [grupos, setGrupos] = useState<string[]>([]);
  const [pessoas, setPessoas] = useState<string[]>([]);

  const { data: dg } = useQuery({ queryKey: ["grupos"], queryFn: () => gruposFn(), enabled: aberto });
  const { data: dp } = useQuery({
    queryKey: ["pessoas-evento"], queryFn: () => pessoasFn(), enabled: aberto,
  });

  const alternar = (lista: string[], set: (v: string[]) => void, id: string) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const salvar = useMutation({
    mutationFn: () =>
      criar({
        data: {
          titulo,
          descricao: descricao || undefined,
          // `new Date("2026-07-30T14:00")` é interpretado como horário LOCAL —
          // é o que queremos. `toISOString()` converte para UTC com o fuso
          // correto embutido.
          quando: new Date(quando).toISOString(),
          group_ids: grupos,
          person_ids: pessoas,
        },
      }),
    onSuccess: () => {
      toast.success("Evento criado.");
      qc.invalidateQueries({ queryKey: ["agenda"] });
      setAberto(false);
      setTitulo(""); setDescricao(""); setQuando(""); setGrupos([]); setPessoas([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const semDestino = grupos.length + pessoas.length === 0;

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" className="ml-auto">
          <CalendarPlus className="size-4" /> Novo evento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo evento na agenda</DialogTitle>
          <DialogDescription>
            Escolha quem vê. O evento aparece na agenda de quem você marcar, e essas pessoas
            recebem uma notificação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="ev-titulo">Título</Label>
            <Input
              id="ev-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Encontro do grupo, prazo, live…"
            />
          </div>
          <div>
            <Label htmlFor="ev-quando">Quando</Label>
            <Input
              id="ev-quando" type="datetime-local" value={quando}
              onChange={(e) => setQuando(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ev-desc">Descrição (opcional)</Label>
            <Textarea
              id="ev-desc" rows={2} value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-black/5 p-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Grupos</p>
              {(dg?.grupos ?? []).length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">Nenhum grupo.</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {(dg?.grupos ?? []).map((g) => (
                    <li key={g.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={grupos.includes(g.id)}
                          onCheckedChange={() => alternar(grupos, setGrupos, g.id)}
                        />
                        {g.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pessoas</p>
              <ul className="mt-1.5 space-y-1.5">
                {(dp?.pessoas ?? []).map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={pessoas.includes(p.id)}
                        onCheckedChange={() => alternar(pessoas, setPessoas, p.id)}
                      />
                      {p.full_name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="items-center gap-3">
          {semDestino && (
            <span className="mr-auto text-xs text-muted-foreground">
              Escolha ao menos um grupo ou pessoa.
            </span>
          )}
          <Button
            onClick={() => salvar.mutate()}
            disabled={!titulo.trim() || !quando || semDestino || salvar.isPending}
          >
            {salvar.isPending ? "Criando…" : "Criar evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
