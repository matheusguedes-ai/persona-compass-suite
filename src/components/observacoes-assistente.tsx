/**
 * Observações para a assistente (#305) — o quadro na ficha da pessoa.
 *
 * O texto aqui orienta o tom e o foco da assistente nas conversas com esta pessoa. O aluno nunca vê,
 * e a assistente nunca cita nem atribui ao mentor. O mentor, por sua vez, continua sem ver as
 * conversas: este quadro só manda informação num sentido.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { mensagemDeErro } from "@/lib/erro-legivel";
import {
  apagarObservacaoDaAssistente,
  listarObservacoesDaAssistente,
  salvarObservacaoDaAssistente,
  type ObservacaoDaAssistente,
} from "@/lib/assistente-observacoes.functions";

const MAX = 2000;

export function ObservacoesDaAssistente({ personId, nome }: { personId: string; nome: string }) {
  const qc = useQueryClient();
  const listarFn = useServerFn(listarObservacoesDaAssistente);
  const salvarFn = useServerFn(salvarObservacaoDaAssistente);
  const apagarFn = useServerFn(apagarObservacaoDaAssistente);
  const chave = ["assistente-observacoes", personId];
  const { data, isLoading, error } = useQuery({ queryKey: chave, queryFn: () => listarFn({ data: { person_id: personId } }) });

  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);

  const salvar = useMutation({
    mutationFn: (v: { id?: string; texto: string }) => salvarFn({ data: { person_id: personId, id: v.id ?? null, texto: v.texto } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: chave });
      if (v.id) setEditando(null);
      else setNovo("");
      toast.success("Observação salva. A assistente passa a considerar na próxima pergunta.");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });
  const apagar = useMutation({
    mutationFn: (id: string) => apagarFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chave });
      toast.success("Observação apagada.");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">Observações para a assistente</p>
          <p className="mt-1 text-xs text-muted-foreground">
            O que a assistente deve ter em mente ao conversar com {nome.split(" ")[0]}: um foco, um cuidado, o momento
            da pessoa. Ela usa como pano de fundo para o tom e as sugestões, pondera, e nunca cita nem diz que veio de você.
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" /> {nome.split(" ")[0]} não vê estas observações. E você continua sem ver as conversas com a assistente.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Textarea
          value={novo}
          onChange={(e) => setNovo(e.target.value.slice(0, MAX))}
          placeholder="Ex.: está se preparando para uma apresentação importante; evitar reforçar a autocrítica."
          rows={3}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{novo.length}/{MAX}</span>
          <Button size="sm" disabled={!novo.trim() || salvar.isPending} onClick={() => salvar.mutate({ texto: novo })}>
            Adicionar observação
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
        {error && <p className="text-xs text-destructive">{mensagemDeErro(error)}</p>}
        {data?.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma observação ainda.</p>}
        {data?.map((o: ObservacaoDaAssistente) =>
          editando?.id === o.id ? (
            <div key={o.id} className="space-y-2 rounded-lg bg-muted/40 p-3">
              <Textarea value={editando.texto} onChange={(e) => setEditando({ id: o.id, texto: e.target.value.slice(0, MAX) })} rows={3} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                <Button size="sm" disabled={!editando.texto.trim() || salvar.isPending}
                  onClick={() => salvar.mutate({ id: o.id, texto: editando.texto })}>
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div key={o.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 p-3">
              <div>
                <p className="whitespace-pre-wrap text-sm">{o.texto}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(o.criada_em).toLocaleDateString("pt-BR")}
                  {o.atualizada_em !== o.criada_em && ` · editada em ${new Date(o.atualizada_em).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="size-7" title="Editar"
                  onClick={() => setEditando({ id: o.id, texto: o.texto })}>
                  <Pencil className="size-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-7" title="Apagar" disabled={apagar.isPending}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apagar esta observação?</AlertDialogTitle>
                      <AlertDialogDescription>
                        A assistente deixa de considerá-la a partir da próxima pergunta. Não dá para desfazer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => apagar.mutate(o.id)}>Apagar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
