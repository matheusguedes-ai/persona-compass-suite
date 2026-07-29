/**
 * Testes · Envios · Devolutivas — um menu só, três telas.
 *
 * O Matheus notou que os três são o mesmo assunto em momentos diferentes:
 * o que existe, o que foi disparado e a conversa depois. Viraram abas.
 *
 * NÃO reescrevi as telas em abas de verdade. Cada uma continua sendo a sua
 * rota, e isto aqui é uma barra que navega entre elas. A diferença importa: a
 * proteção de permissão de cada rota continua valendo por si, sem depender de
 * eu lembrar de replicá-la numa aba.
 *
 * A aba só aparece se a pessoa tiver a permissão dela. Um colaborador com
 * acesso apenas a Envios não pode ganhar Testes e Devolutivas de brinde só
 * porque os menus foram agrupados — esse era o risco real desta mudança.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/team.functions";
import { cn } from "@/lib/utils";

const ABAS = [
  { to: "/testes", label: "Testes", perm: "testes" },
  { to: "/envios", label: "Envios", perm: "envios" },
  { to: "/devolutivas", label: "Devolutivas", perm: "devolutivas" },
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

  // Com uma aba só, a barra não informa nada — só ocupa espaço.
  if (visiveis.length <= 1) return null;

  return (
    <div className="inline-flex rounded-lg bg-muted p-1">
      {visiveis.map((a) => {
        const ativa = pathname === a.to || pathname.startsWith(a.to + "/");
        return (
          <Link
            key={a.to}
            to={a.to}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
  );
}
