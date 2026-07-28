/**
 * Painel da devolutiva — a tela que o mentor abre DURANTE a conversa.
 *
 * É diferente do relatório de propósito. O relatório é um documento longo,
 * feito para ler sozinho. Aqui o mentor está com a pessoa na frente (ou
 * compartilhando a tela) e precisa apontar para as coisas: tudo em cartões,
 * lado a lado, sem rolar atrás do que quer mostrar.
 *
 * Duas coisas aparecem antes de qualquer número, e é de propósito:
 * 1. o selo de confiabilidade — se a pessoa respondeu no automático, isso muda
 *    como o mentor conduz a conversa inteira, e precisa estar na cara dele
 *    antes de interpretar qualquer coisa;
 * 2. o que ficou combinado na devolutiva anterior — sem isso, toda conversa
 *    recomeça do zero.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { carregarPainel } from "@/lib/devolutivas.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, TriangleAlert, History } from "lucide-react";
import { cn } from "@/lib/utils";

const FAIXA_COR: Record<string, string> = {
  Crítico: "bg-red-500",
  Baixo: "bg-orange-500",
  Satisfatório: "bg-amber-500",
  Desenvolvido: "bg-emerald-500",
  Excelente: "bg-teal-500",
};

/** Mesma régua de faixas de `derivations.ts`, para colorir sem consultar o banco. */
function corDaNota(v: number) {
  if (v < 20) return "bg-red-500";
  if (v < 40) return "bg-orange-500";
  if (v < 60) return "bg-amber-500";
  if (v < 80) return "bg-emerald-500";
  return "bg-teal-500";
}

function Cartao({
  titulo,
  acessorio,
  children,
  className,
}: {
  titulo: string;
  acessorio?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-black/5 bg-card p-5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{titulo}</h2>
        {acessorio}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BarraHorizontal({ label, valor, cor }: { label: string; valor: number; cor?: string | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{valor}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", !cor && corDaNota(valor))}
          style={{ width: `${Math.max(0, Math.min(100, valor))}%`, ...(cor ? { background: cor } : {}) }}
        />
      </div>
    </div>
  );
}

export function PainelDevolutiva({ id }: { id: string }) {
  const fn = useServerFn(carregarPainel);
  const { data, isLoading, error } = useQuery({
    queryKey: ["painel-devolutiva", id],
    queryFn: () => fn({ data: { id } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando o painel…</p>;
  if (error) return <p className="text-sm text-red-700">{(error as Error).message}</p>;
  if (!data) return null;

  const { devolutiva, anterior, partes } = data;
  // Se qualquer inventário saiu com ressalva, o mentor precisa saber — vale a
  // pior das ressalvas, não a média.
  const pior = partes
    .map((p) => p.qualidade)
    .filter((q): q is NonNullable<typeof q> => !!q)
    .sort((a, b) => (a.nivel === "baixa" ? -1 : b.nivel === "baixa" ? 1 : a.nivel === "media" ? -1 : 1))[0];
  const disc = partes.find((p) => p.is_disc);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/devolutivas">
              <ArrowLeft className="size-3.5" /> Devolutivas
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{devolutiva.person_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {partes.length === 0
              ? "Nenhum inventário concluído para mostrar."
              : `${partes.length} ${partes.length === 1 ? "inventário" : "inventários"} · ${partes
                  .map((p) => p.titulo)
                  .filter(Boolean)
                  .join(" · ")}`}
          </p>
        </div>
        {partes[0]?.response_id && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/relatorio/${partes[0].response_id}`} target="_blank" rel="noreferrer">
              <FileText className="size-3.5" /> Relatório completo
            </a>
          </Button>
        )}
      </header>

      {/* Ressalva antes dos números: muda como o mentor conduz tudo o que vem depois. */}
      {pior && pior.nivel !== "alta" && (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <p>
            <strong>Leia os números com cautela.</strong> O preenchimento sugere{" "}
            {pior.motivos.join(" e ")}. Não invalida o resultado, mas vale confirmar com a pessoa se o
            que aparece aqui faz sentido para ela antes de tirar conclusões.
          </p>
        </div>
      )}

      {/* De onde a conversa parou. */}
      {anterior?.agreements && (
        <div className="rounded-xl border border-black/5 bg-muted/30 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <History className="size-4" /> Combinado na devolutiva anterior
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{anterior.agreements}</p>
        </div>
      )}

      {partes.length === 0 && (
        <p className="rounded-xl bg-muted/40 p-6 text-sm text-muted-foreground">
          Esta devolutiva não está ligada a nenhum resultado concluído. Se a pessoa respondeu depois
          que a devolutiva foi criada, vale criar outra a partir da fila.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Competências: o cartão mais usado na conversa, então vem primeiro. */}
        {disc && disc.competencias.length > 0 && (
          <Cartao titulo="Competências" className="lg:col-span-2">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {disc.competencias.map((c) => (
                <BarraHorizontal key={c.name} label={c.name} valor={Math.round(c.natural)} />
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Calculadas a partir do seu DISC — não são um teste à parte.
            </p>
          </Cartao>
        )}

        {disc && (
          <Cartao titulo="Natural × Adaptado" acessorio={<span className="text-sm text-muted-foreground">{disc.perfil ?? "sem predominância"}</span>}>
            <div className="space-y-4">
              {disc.fatores.map((f) => (
                <div key={f.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{f.label} <span className="text-xs text-muted-foreground">({f.key})</span></span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      nat {f.natural} · adp {f.adaptado}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${f.natural}%`, background: f.color ?? "var(--primary)" }} />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full opacity-55" style={{ width: `${f.adaptado}%`, background: f.color ?? "var(--primary)" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Cartao>
        )}

        {/* Um cartão por instrumento respondido, DISC já coberto acima. */}
        {partes
          .filter((p) => !p.is_disc)
          .map((p) => (
            <Cartao
              key={p.response_id ?? p.titulo}
              titulo={p.titulo ?? "Inventário"}
              acessorio={p.is_mbti && p.mbti ? <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold tracking-widest">{p.mbti.tipo}</span> : undefined}
            >
              {p.is_mbti && p.mbti ? (
                <div className="space-y-3">
                  {p.mbti.pares.map((par) => {
                    const empatado = Math.max(par.leftPct, par.rightPct) < 55;
                    return (
                      <div key={par.left}>
                        <div className="flex justify-between text-xs">
                          <span className={par.preferred === par.left ? "font-medium" : "text-muted-foreground"}>
                            {par.left} {Math.round(par.leftPct)}%
                          </span>
                          <span className={par.preferred === par.right ? "font-medium" : "text-muted-foreground"}>
                            {Math.round(par.rightPct)}% {par.right}
                          </span>
                        </div>
                        <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full" style={{ width: `${par.leftPct}%`, background: "var(--primary)" }} />
                        </div>
                        {empatado && <p className="mt-1 text-[11px] text-muted-foreground">praticamente empatado</p>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {p.fatores
                    .slice()
                    .sort((a, b) => b.natural - a.natural)
                    .map((f) => (
                      <BarraHorizontal key={f.key} label={f.label} valor={f.natural} cor={f.color} />
                    ))}
                </div>
              )}
              {p.fatores.length === 0 && !p.is_mbti && (
                <p className="text-sm text-muted-foreground">Inventário sem dimensões pontuadas.</p>
              )}
            </Cartao>
          ))}

        {disc && disc.indices.length > 0 && (
          <Cartao titulo="Índices comportamentais">
            <div className="space-y-3">
              {disc.indices.map((i) => (
                <BarraHorizontal key={i.key} label={i.label} valor={Math.round(i.value)} />
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Derivados do seu DISC.</p>
          </Cartao>
        )}
      </div>
    </div>
  );
}
