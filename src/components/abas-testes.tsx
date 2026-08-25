/**
 * Testes · Envios — um menu só, duas telas.
 *
 * O Matheus notou que são o mesmo assunto em momentos diferentes: o que
 * existe e o que foi disparado. Viraram abas. Devolutivas era a terceira —
 * saiu daqui e virou o menu Mentorias, de primeiro nível (Fecha #213).
 *
 * NÃO reescrevi as telas em abas de verdade. Cada uma continua sendo a sua
 * rota, e isto aqui é uma barra que navega entre elas. A diferença importa: a
 * proteção de permissão de cada rota continua valendo por si, sem depender de
 * eu lembrar de replicá-la numa aba.
 *
 * A aba só aparece se a pessoa tiver a permissão dela. Um colaborador com
 * acesso apenas a Envios não pode ganhar Testes de brinde só porque os menus
 * foram agrupados — esse era o risco real desta mudança.
 */
import { useLayoutEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/team.functions";
import { cn } from "@/lib/utils";
import { useFadeDeRolagem } from "@/lib/use-fade-de-rolagem";

const ABAS = [
  { to: "/testes", label: "Testes", perm: "testes" },
  { to: "/envios", label: "Envios", perm: "envios" },
  // #280 — central de acesso e download; reaproveita a permissão "testes" (a
  // mesma que já protege o painel de respostas do construtor) em vez de
  // criar uma quarta permissão só para isto.
  { to: "/respostas", label: "Respostas", perm: "testes" },
] as const;

export function AbasDeTestes() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fn = useServerFn(getMyMembership);
  const { data } = useQuery({
    queryKey: ["my-membership"], queryFn: () => fn(), staleTime: 300_000,
  });

  const kind = data?.kind ?? "owner";
  const permissions = data?.permissions ?? [];
  const visiveis = ABAS.filter((a) => kind === "owner" || permissions.includes(a.perm));

  // Hooks sempre chamados, nunca depois de um return — mesmo quando a barra
  // vai acabar não aparecendo (uma aba só).
  const { ref, fade, atualizar } = useFadeDeRolagem<HTMLDivElement>();
  useLayoutEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-ativo="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Com uma aba só, a barra não informa nada — só ocupa espaço.
  if (visiveis.length <= 1) return null;

  return (
    <div className="relative inline-flex max-w-full">
      {fade.esquerda && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 rounded-l-lg bg-gradient-to-r from-muted to-transparent" />
      )}
      <div ref={ref} onScroll={atualizar} className="inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-1">
        {visiveis.map((a) => {
          const ativa = pathname === a.to || pathname.startsWith(a.to + "/");
          return (
            <Link
              key={a.to}
              to={a.to}
              data-ativo={ativa}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                ativa
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {a.label}
            </Link>
          );
        })}
      </div>
      {fade.direita && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 rounded-r-lg bg-gradient-to-l from-muted to-transparent" />
      )}
    </div>
  );
}
