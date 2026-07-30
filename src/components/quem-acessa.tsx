/**
 * Escolher quem abre um conteúdo: grupos e pessoas.
 *
 * Nada marcado = aberto para todos os alunos. É o padrão de propósito: foi
 * assim que a Academy nasceu, e obrigar a escolher transformaria cada trilha
 * nova numa lista de chamada antes de existir conteúdo.
 *
 * Quem não for escolhido continua vendo o card — trancado. O professor precisa
 * ler isso na hora de decidir, então está escrito na própria caixa.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { meusGrupos } from "@/lib/comunidade.functions";
import { listarPessoasParaDevolutiva } from "@/lib/devolutivas.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Lock, Unlock } from "lucide-react";

export function QuemAcessa({
  grupos, pessoas, setGrupos, setPessoas, ativo = true,
}: {
  grupos: string[];
  pessoas: string[];
  setGrupos: (v: string[]) => void;
  setPessoas: (v: string[]) => void;
  /** Só busca as listas quando o diálogo está aberto. */
  ativo?: boolean;
}) {
  const gruposFn = useServerFn(meusGrupos);
  const pessoasFn = useServerFn(listarPessoasParaDevolutiva);
  const { data: dg } = useQuery({ queryKey: ["grupos"], queryFn: () => gruposFn(), enabled: ativo });
  const { data: dp } = useQuery({
    queryKey: ["pessoas-destino"], queryFn: () => pessoasFn(), enabled: ativo,
  });

  const alternar = (lista: string[], set: (v: string[]) => void, id: string) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const aberta = grupos.length + pessoas.length === 0;

  return (
    <div className="space-y-2">
      <Label>Quem tem acesso</Label>
      <p
        className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] ${
          aberta ? "bg-muted/50 text-muted-foreground" : "bg-amber-50 text-amber-900"
        }`}
      >
        {aberta ? <Unlock className="mt-px size-3.5 shrink-0" /> : <Lock className="mt-px size-3.5 shrink-0" />}
        <span>
          {aberta
            ? "Sem marcar ninguém, fica liberado para todos os alunos da conta."
            : `Liberado para ${grupos.length} grupo${grupos.length === 1 ? "" : "s"} e ${pessoas.length} pessoa${pessoas.length === 1 ? "" : "s"}. Os demais continuam vendo a capa, com cadeado, e não recebem as aulas.`}
        </span>
      </p>

      <div className="max-h-52 space-y-3 overflow-y-auto rounded-lg border border-black/5 p-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Grupos</p>
          {(dg?.grupos ?? []).length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Nenhum grupo ainda.</p>
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
          {(dp?.pessoas ?? []).length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Nenhuma pessoa cadastrada.</p>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
