/**
 * Agenda de devolutivas — visão de mês.
 *
 * Todo cálculo de data acontece AQUI, no navegador, e o período vai pronto para
 * o servidor. O servidor roda em UTC: se ele decidisse onde o mês começa,
 * viraria o mês três horas antes do Brasil e a devolutiva do último dia às 22h
 * sumiria da tela.
 *
 * Serve o master (`/gestao`) e o mentor (`/aluno/gestao`) sem mudar nada: a RLS
 * já recorta os dados de cada um.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { agendaDoMes, type Compromisso } from "@/lib/gestao.functions";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function mesmoDia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function horaBr(iso: string): string | null {
  const d = new Date(iso);
  // Meia-noite em ponto quase sempre significa "sem hora definida", não 00:00.
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * `area` decide só para ONDE o compromisso leva — o mentor e o aluno vivem os
 * dois em /aluno, então ela não serve para decidir escopo.
 *
 * `somenteMinhas` é separado de propósito: o mentor abre a agenda em
 * `/aluno/gestao` e precisa ver o GRUPO dele; o aluno abre em
 * `/aluno/devolutivas` e precisa ver só o que é dele. Amarrar as duas coisas na
 * mesma prop deixaria o mentor com uma agenda quase sempre vazia.
 */
export function Agenda({
  area = "dono",
  somenteMinhas = false,
}: {
  area?: "dono" | "aluno";
  somenteMinhas?: boolean;
}) {
  const hoje = new Date();
  const [ref, setRef] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  // O intervalo do mês, em horário LOCAL, convertido para ISO com fuso.
  const { de, ate } = useMemo(
    () => ({
      de: new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0).toISOString(),
      ate: new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 0, 0, 0).toISOString(),
    }),
    [ref],
  );

  const fn = useServerFn(agendaDoMes);
  const { data, isLoading } = useQuery({
    queryKey: ["agenda", de, ate, somenteMinhas],
    queryFn: () => fn({ data: { de, ate, somenteMinhas } }),
  });

  const compromissos = data?.compromissos ?? [];

  // As células do calendário: dias do mês, precedidos dos vazios até cair no
  // dia da semana certo.
  const celulas = useMemo(() => {
    const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const diasNoMes = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const vazios = Array.from({ length: primeiro.getDay() }, () => null);
    const dias = Array.from(
      { length: diasNoMes },
      (_, i) => new Date(ref.getFullYear(), ref.getMonth(), i + 1),
    );
    return [...vazios, ...dias];
  }, [ref]);

  const doDia = (d: Date): Compromisso[] =>
    compromissos.filter((c) => mesmoDia(new Date(c.quando), d));

  const proximos = compromissos
    .filter((c) => new Date(c.quando).getTime() >= Date.now())
    .slice(0, 5);

  const rotuloMes = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-40 text-sm font-medium capitalize">{rotuloMes}</span>
        <Button
          variant="outline" size="sm"
          onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="ghost" size="sm"
          onClick={() => setRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
        >
          Hoje
        </Button>
        {isLoading && <span className="text-xs text-muted-foreground">carregando…</span>}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[42rem]">
          <div className="grid grid-cols-7 gap-1 pb-1">
            {SEMANA.map((d) => (
              <div key={d} className="px-1 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {celulas.map((d, i) => {
              if (!d) return <div key={`v${i}`} />;
              const itens = doDia(d);
              const ehHoje = mesmoDia(d, hoje);
              return (
                <div
                  key={d.toISOString()}
                  className={`min-h-20 rounded-lg p-1.5 ring-1 ${
                    ehHoje ? "bg-primary/5 ring-primary/40" : "bg-card ring-black/5"
                  }`}
                >
                  <span
                    className={`text-xs tabular-nums ${
                      ehHoje ? "font-semibold text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <ul className="mt-1 space-y-1">
                    {itens.map((c) => (
                      <li key={c.id}>
                        <Link
                          to={area === "aluno" ? "/aluno/devolutivas" : "/devolutivas"}
                          className={`block truncate rounded px-1.5 py-1 text-[11px] leading-tight ${
                            c.status === "realizada"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : c.atrasada
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                          }`}
                          title={`${c.person_name}${horaBr(c.quando) ? ` · ${horaBr(c.quando)}` : ""}`}
                        >
                          {horaBr(c.quando) && (
                            <span className="font-medium tabular-nums">{horaBr(c.quando)} </span>
                          )}
                          {c.person_name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* O calendário mostra o mês; esta lista responde "e agora, o que vem?" */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-black/5">
        <h3 className="text-sm font-medium">Próximos</h3>
        {proximos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nada marcado daqui para a frente neste mês.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proximos.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{c.person_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(c.quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  {horaBr(c.quando) ? ` · ${horaBr(c.quando)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
