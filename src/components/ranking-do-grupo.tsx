/**
 * Ranking visto pelo mentor, dentro do grupo.
 *
 * Mesma lista que o aluno vê. Quem tem zero aparece igual — para o mentor, é
 * justamente essa a informação útil: quem não está participando.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { rankingDoGrupo } from "@/lib/pontos.functions";
import { Avatar } from "@/components/avatar-upload";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function RankingDoGrupo({ groupId }: { groupId: string }) {
  const fn = useServerFn(rankingDoGrupo);
  const { data, isLoading } = useQuery({
    queryKey: ["ranking", groupId],
    queryFn: () => fn({ data: { group_id: groupId } }),
  });

  const linhas = data?.ranking ?? [];
  const semConta = linhas.length === 0;

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Pontos por participar: aula, devolutiva e comunidade. Responder teste não pontua — um
        ranking que sobe ao responder pagaria a pessoa para clicar rápido.
      </p>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && semConta && (
        <p className="rounded-xl bg-muted/40 p-6 text-sm text-muted-foreground">
          Ninguém do grupo criou conta ainda. O ranking começa quando os avaliados entram na
          plataforma — o primeiro acesso vai por e-mail.
        </p>
      )}
      {linhas.length > 0 && (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
          {linhas.map((r) => (
            <li key={r.person_id} className="flex items-center gap-3 p-4">
              <span className={cn("w-6 shrink-0 text-center text-sm font-semibold tabular-nums",
                r.posicao <= 3 && r.total > 0 ? "text-amber-600" : "text-muted-foreground")}>
                {r.posicao}
              </span>
              <Avatar url={r.avatar_url} nome={r.nome} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {r.acoes === 0 ? "nenhuma participação ainda" : `${r.acoes} participações`}
                </p>
              </div>
              {r.posicao === 1 && r.total > 0 && <Trophy className="size-4 text-amber-500" />}
              <span className="shrink-0 tabular-nums text-sm font-semibold">{r.total}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
