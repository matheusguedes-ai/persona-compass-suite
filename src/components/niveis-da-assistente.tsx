/**
 * #317 — onde o DONO da conta libera os níveis da assistente (Básica, Smart, Pro): a aba Acesso da ficha
 * do grupo (`EscolhaDeNiveis`, salva junto com o resto do acesso) e a ficha da pessoa
 * (`NiveisDaAssistenteDaPessoa`, com o botão dela). Marcar ao menos um nível É liberar a assistente;
 * nenhum marcado = a assistente não aparece por aquele caminho. O aluno usa a SOMA do que vem pelos
 * grupos dele e pela liberação individual — nada aqui calcula isso: o total vem do servidor.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { mensagemDeErro } from "@/lib/erro-legivel";
import {
  definirNivelDaAssistenteDaPessoa,
  nivelDaAssistenteDaPessoa,
} from "@/lib/assistente-niveis.functions";
import {
  CATEGORIAS,
  NIVEL,
  naOrdem,
  nomesDosNiveis,
  type Categoria,
} from "@/lib/assistente/niveis";

/** As três caixas, cada uma com a explicação de uma linha. Controlada: quem salva é quem usa. */
export function EscolhaDeNiveis({
  valor,
  onChange,
  desabilitado,
}: {
  valor: Categoria[];
  onChange: (v: Categoria[]) => void;
  desabilitado?: boolean;
}) {
  return (
    <div className="space-y-2">
      {CATEGORIAS.map((c) => {
        const marcado = valor.includes(c);
        return (
          <label
            key={c}
            className={
              "flex items-start gap-3 rounded-lg border border-input p-3 " +
              (desabilitado ? "cursor-default opacity-70" : "cursor-pointer hover:bg-muted/40")
            }
          >
            <Checkbox
              checked={marcado}
              disabled={desabilitado}
              onCheckedChange={(v) =>
                onChange(naOrdem(v === true ? [...valor, c] : valor.filter((x) => x !== c)))
              }
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium">{NIVEL[c].nome}</span>
              <span className="block text-xs text-muted-foreground">{NIVEL[c].explicacao}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function NiveisDaAssistenteDaPessoa({ personId, nome }: { personId: string; nome: string }) {
  const qc = useQueryClient();
  const lerFn = useServerFn(nivelDaAssistenteDaPessoa);
  const salvarFn = useServerFn(definirNivelDaAssistenteDaPessoa);
  const chave = ["assistente-niveis-pessoa", personId];
  const { data, isLoading, error } = useQuery({
    queryKey: chave,
    queryFn: () => lerFn({ data: { person_id: personId } }),
  });

  // A edição começa do que está salvo; `null` = ainda não mexeu.
  const [editando, setEditando] = useState<Categoria[] | null>(null);
  const individual = editando ?? data?.individual ?? [];
  const mudou = editando !== null && editando.join() !== (data?.individual ?? []).join();

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { person_id: personId, categorias: individual } }),
    onSuccess: () => {
      setEditando(null);
      void qc.invalidateQueries({ queryKey: chave });
      toast.success("Níveis da assistente atualizados. Valem a partir da próxima pergunta.");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  if (isLoading) return null;
  if (error || !data) {
    return (
      <div className="rounded-xl bg-card p-5 text-sm text-destructive ring-1 ring-black/5 dark:ring-white/10">
        {mensagemDeErro(error)}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-black/5 dark:ring-white/10">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Assistente — níveis liberados</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.total.length
          ? `${nome} pode usar: ${nomesDosNiveis(data.total)}.`
          : `A assistente não está liberada para ${nome}.`}
        {data.total.length > 1 &&
          " Com mais de um nível liberado, a escolha fica com a pessoa, na tela da assistente."}
      </p>

      {data.porGrupo.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {data.porGrupo.map((g) => (
            <li key={g.grupoId}>
              Pelo grupo <span className="font-medium text-foreground">{g.grupo}</span>:{" "}
              {nomesDosNiveis(g.categorias)}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-black/5 dark:border-white/10 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Liberação individual
        </p>
        {!data.temLogin ? (
          <p className="text-sm text-muted-foreground">
            {nome} ainda não tem login na plataforma. A liberação individual vale para o login — até
            lá, libere pelo grupo.
          </p>
        ) : data.deOutraConta ? (
          <p className="text-sm text-muted-foreground">
            A liberação individual deste login foi feita por outra conta.
          </p>
        ) : (
          <>
            <EscolhaDeNiveis
              valor={individual}
              onChange={setEditando}
              desabilitado={!data.podeEditar || salvar.isPending}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Soma com o que vem pelos grupos. Nenhum marcado aqui = só vale o que vem pelos grupos.
            </p>
            {data.podeEditar ? (
              <div className="mt-3 flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => salvar.mutate()}
                  disabled={!mudou || salvar.isPending}
                >
                  {salvar.isPending ? "Salvando…" : "Salvar níveis"}
                </Button>
                {mudou && (
                  <button
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => setEditando(null)}
                  >
                    Desfazer
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Só o dono da conta muda os níveis da assistente.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
