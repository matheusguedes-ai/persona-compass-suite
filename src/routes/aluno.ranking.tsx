/**
 * Ranking do grupo, no painel do avaliado.
 *
 * Visível para o grupo todo, por decisão do Matheus. Quem ainda não pontuou
 * aparece no fim em vez de sumir — o ranking também serve para o mentor ver
 * quem não está engajando, e sumir com quem tem zero esconderia justamente
 * essa informação.
 *
 * Responder teste NÃO pontua. Um ranking que sobe quando você responde paga a
 * pessoa para clicar rápido, e é contra isso que os testes foram reescritos.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { gruposDoAvaliado } from "@/lib/comunidade.functions";
import { rankingDoGrupo, meusPontos, ACOES } from "@/lib/pontos.functions";
import { Avatar } from "@/components/avatar-upload";
import { Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function Pagina() {
  const { ver } = Route.useSearch();
  const gruposFn = useServerFn(gruposDoAvaliado);
  const rankFn = useServerFn(rankingDoGrupo);
  const pontosFn = useServerFn(meusPontos);
  const [escolhido, setEscolhido] = useState<string | null>(null);

  const { data: gruposData, isLoading } = useQuery({
    queryKey: ["grupos-do-avaliado", ver ?? null],
    queryFn: () => gruposFn({ data: { preview_person_id: ver ?? null } }),
  });
  const grupos = gruposData?.grupos ?? [];
  const atual = escolhido ?? grupos[0]?.id ?? null;

  const { data: rank } = useQuery({
    queryKey: ["ranking", atual],
    queryFn: () => rankFn({ data: { group_id: atual! } }),
    enabled: !!atual,
  });
  const { data: meus } = useQuery({
    queryKey: ["meus-pontos", ver ?? null],
    queryFn: () => pontosFn({ data: { preview_person_id: ver ?? null } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (grupos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
        <Users className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-base font-medium">Você ainda não está em nenhum grupo</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          O ranking acontece dentro dos grupos. Peça ao seu mentor para te adicionar a um.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ranking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pontos por participar: assistir aula, comparecer à devolutiva, publicar e conversar na
          comunidade. Responder teste não pontua — é para você responder com calma, não rápido.
        </p>
      </div>

      {meus && meus.total > 0 && (
        <div className="rounded-xl border border-black/5 bg-card p-5">
          <p className="text-sm text-muted-foreground">Seus pontos</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{meus.total}</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {meus.porAcao.map((a) => (
              <li key={a.acao}>{a.rotulo}: <strong className="text-foreground">{a.total}</strong> ({a.vezes}×)</li>
            ))}
          </ul>
        </div>
      )}

      {grupos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {grupos.map((g) => (
            <button
              key={g.id} onClick={() => setEscolhido(g.id)}
              className={cn("rounded-full px-3 py-1.5 text-sm transition",
                g.id === atual ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-black/5 bg-card">
        <ul className="divide-y divide-black/5">
          {(rank?.ranking ?? []).map((r) => (
            <li key={r.person_id} className={cn("flex items-center gap-3 p-4", r.eu && "bg-primary/5")}>
              <span className={cn("w-6 shrink-0 text-center text-sm font-semibold tabular-nums",
                r.posicao <= 3 ? "text-amber-600" : "text-muted-foreground")}>
                {r.posicao}
              </span>
              <Avatar url={r.avatar_url} nome={r.nome} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {r.nome}{r.eu && <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>}
              </span>
              {r.posicao === 1 && r.total > 0 && <Trophy className="size-4 text-amber-500" />}
              <span className="shrink-0 tabular-nums text-sm font-semibold">{r.total}</span>
            </li>
          ))}
        </ul>
        {(rank?.ranking ?? []).length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">Ninguém do grupo tem conta ainda.</p>
        )}
      </div>

      <details className="rounded-xl bg-muted/40 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Como se ganha ponto</summary>
        <ul className="mt-3 space-y-1 text-muted-foreground">
          {(Object.keys(ACOES) as Array<keyof typeof ACOES>).map((k) => (
            <li key={k}>{ACOES[k].rotulo}: <strong className="text-foreground">{ACOES[k].pontos}</strong>
              {ACOES[k].tetoDiario && <span className="text-xs"> — até {ACOES[k].tetoDiario}× por dia</span>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export const Route = createFileRoute("/aluno/ranking")({
  validateSearch: (s: Record<string, unknown>) => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
  }),
  head: () => ({ meta: [{ title: "Ranking" }, { name: "robots", content: "noindex" }] }),
  component: Pagina,
});
