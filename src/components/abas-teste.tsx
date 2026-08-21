/**
 * Editar · Respostas — navegação dentro de UM teste.
 *
 * Só existe para teste SEM interpretação (#212 F1/F2): teste de template
 * (DISC, MBTI…) continua com o fluxo de devolutiva/relatório de sempre, sem
 * esta aba — colocá-la lá duplicaria um jeito de ver resultado que já existe
 * e não bate com o que este painel mostra (agregado bruto, sem perfil).
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const ABAS = [
  { to: "/testes/$versionId/editar", label: "Editar" },
  { to: "/testes/$versionId/respostas", label: "Respostas" },
] as const;

export function AbasDeTeste({ versionId, hasInterpretation }: { versionId: string; hasInterpretation: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (hasInterpretation) return null;

  return (
    <div className="inline-flex rounded-lg bg-muted p-1">
      {ABAS.map((a) => {
        const href = a.to.replace("$versionId", versionId);
        const ativa = pathname === href;
        return (
          <Link
            key={a.to}
            to={a.to}
            params={{ versionId }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              ativa ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}
