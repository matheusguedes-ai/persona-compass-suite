/**
 * A coluna ao lado do feed: ranking e membros.
 *
 * O Matheus disse que a comunidade estava "magrinha" — era só o feed. O ranking
 * existia em menu separado, e não havia como ver quem mais está no grupo.
 *
 * Por enquanto isto é ADITIVO: o menu Ranking continua onde estava. Tirar o
 * menu é a segunda metade do trabalho, e mexer nele sem terminar deixaria o
 * aluno sem lugar nenhum para ver a própria pontuação.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { rankingDoGrupo } from "@/lib/pontos.functions";
import { membrosDosGrupos } from "@/lib/comunidade.functions";
import { Avatar } from "@/components/avatar-upload";
import { Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function LadoDaComunidade({ grupos }: { grupos: Array<{ id: string; name: string }> }) {
  const [aba, setAba] = useState<"ranking" | "membros">("ranking");
  const rankFn = useServerFn(rankingDoGrupo);
  const membrosFn = useServerFn(membrosDosGrupos);

  // O ranking é POR GRUPO. Com vários, mostra o do primeiro — somar pontos de
  // grupos diferentes numa lista só compararia gente que não disputa entre si.
  const grupoDoRanking = grupos[0];

  const { data: rank } = useQuery({
    queryKey: ["ranking-lado", grupoDoRanking?.id],
    queryFn: () => rankFn({ data: { group_id: grupoDoRanking!.id } }),
    enabled: aba === "ranking" && !!grupoDoRanking,
  });
  const { data: mem } = useQuery({
    queryKey: ["membros-lado", grupos.map((g) => g.id).join(",")],
    queryFn: () => membrosFn({ data: { group_ids: grupos.map((g) => g.id) } }),
    enabled: aba === "membros" && grupos.length > 0,
  });

  if (grupos.length === 0) return null;

  return (
    <aside className="space-y-3">
      <div className="inline-flex w-full rounded-lg bg-muted p-1">
        {(["ranking", "membros"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setAba(v)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              aba === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "ranking" ? <Trophy className="size-3.5" /> : <Users className="size-3.5" />}
            {v === "ranking" ? "Ranking" : "Membros"}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-black/5">
        {aba === "ranking" ? (
          <>
            {grupos.length > 1 && (
              <p className="mb-2 text-xs text-muted-foreground">{grupoDoRanking.name}</p>
            )}
            {(rank?.ranking ?? []).length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Ninguém pontuou ainda.
              </p>
            ) : (
              <ol className="space-y-2">
                {(rank?.ranking ?? []).slice(0, 10).map((l) => (
                  <li
                    key={l.person_id}
                    className={cn("flex items-center gap-2.5", l.eu && "font-medium")}
                  >
                    <span className="w-4 text-right text-xs tabular-nums text-muted-foreground">
                      {l.posicao}
                    </span>
                    <Avatar url={l.avatar_url} nome={l.nome} className="size-6" />
                    <span className="min-w-0 flex-1 truncate text-sm">{l.nome}</span>
                    <span className="text-sm tabular-nums">{l.total}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <>
            <ul className="space-y-2">
              {(mem?.membros ?? []).map((m) => (
                <li key={m.person_id} className="flex items-center gap-2.5">
                  <Avatar url={m.avatar_url} nome={m.nome} className="size-7" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{m.nome}</p>
                    {m.cargo && (
                      <p className="truncate text-xs text-muted-foreground">{m.cargo}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {(mem?.membros ?? []).length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Ninguém por aqui ainda.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
