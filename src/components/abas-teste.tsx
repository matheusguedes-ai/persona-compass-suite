/**
 * Editar · Respostas — navegação dentro de UM teste.
 *
 * Só existe para teste SEM interpretação (#212 F1/F2): teste de template
 * (DISC, MBTI…) continua com o fluxo de devolutiva/relatório de sempre, sem
 * esta aba — colocá-la lá duplicaria um jeito de ver resultado que já existe
 * e não bate com o que este painel mostra (agregado bruto, sem perfil).
 */
import { useLayoutEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useFadeDeRolagem } from "@/lib/use-fade-de-rolagem";

const ABAS = [
  { to: "/testes/$versionId/editar", label: "Editar" },
  { to: "/testes/$versionId/respostas", label: "Respostas" },
] as const;

export function AbasDeTeste({ versionId, hasInterpretation }: { versionId: string; hasInterpretation: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Hooks antes de qualquer return — mesmo quando a barra acaba não aparecendo.
  const { ref, fade, atualizar } = useFadeDeRolagem<HTMLDivElement>();
  useLayoutEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-ativo="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (hasInterpretation) return null;

  return (
    <div className="relative inline-flex max-w-full">
      {fade.esquerda && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 rounded-l-lg bg-gradient-to-r from-muted to-transparent" />
      )}
      <div ref={ref} onScroll={atualizar} className="inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-1">
        {ABAS.map((a) => {
          const href = a.to.replace("$versionId", versionId);
          const ativa = pathname === href;
          return (
            <Link
              key={a.to}
              to={a.to}
              params={{ versionId }}
              data-ativo={ativa}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                ativa ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
