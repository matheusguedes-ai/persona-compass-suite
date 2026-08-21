/**
 * #212 Fase 4, Fatia 2 — painel de respostas de um teste sem interpretação.
 *
 * Visão agregada (contagem/percentual por opção, média+distribuição de
 * escala, lista de textos) e, só em teste identificado, a resposta de cada
 * pessoa. Em teste anônimo, a proteção de "só mostra com 3+ respostas" é
 * imposta pela RLS de `test_answers` (`pode_ver_conteudo_resposta`) — o que
 * este componente faz com `locked` é só refletir isso na tela sem nem tentar
 * buscar o que o banco já bloquearia.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getResponsesSummary, getIndividualResponse } from "@/lib/tests.functions";
import type { QuestionType } from "@/lib/tests.functions";
import { AbasDeTeste } from "@/components/abas-teste";
import { Avatar } from "@/components/avatar-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Lock, Inbox, CheckSquare, Circle, SlidersHorizontal, AlignLeft } from "lucide-react";

export const Route = createFileRoute("/_app/testes/$versionId/respostas")({
  head: () => ({ meta: [{ title: "Respostas — Métrica Humana" }] }),
  component: RespostasPage,
});

const TYPE_ICON: Partial<Record<QuestionType, React.ComponentType<{ className?: string }>>> = {
  multiple_choice: Circle,
  checkboxes: CheckSquare,
  linear_scale: SlidersHorizontal,
  short_text: AlignLeft,
};

type Pergunta = { id: string; prompt: string; type: QuestionType; section_id: string | null };
type Secao = { id: string; title: string; description: string | null };
// As 4 formas possíveis — teste sem interpretação só usa esses tipos
// (TIPOS_SEM_INTERPRETACAO), então não existe um "outro tipo" de verdade
// aqui; um quinto membro genérico só atrapalharia o TS a estreitar a união.
type Agregado =
  | { question_id: string; type: "multiple_choice" | "checkboxes"; total_respondentes: number; opcoes: Array<{ option_id: string; label: string; count: number; pct: number }> }
  | { question_id: string; type: "linear_scale"; total_respondentes: number; media: number | null; distribuicao: Array<{ valor: number; count: number }> }
  | { question_id: string; type: "short_text"; total_respondentes: number; textos: Array<{ response_id: string; text: string }> };

function RespostasPage() {
  const { versionId } = Route.useParams();
  const navigate = useNavigate();
  const fn = useServerFn(getResponsesSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["responses-summary", versionId],
    queryFn: () => fn({ data: { version_id: versionId } }),
  });
  const [aberto, setAberto] = useState<string | null>(null);

  if (isLoading || !data) return <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
  const { version, lineage, invited, responded, missing, locked, questions, sections, aggregates, respondents } = data;

  // #212 F4 — resultados agrupados por seção; teste sem seção (todo teste
  // anterior a esta fatia) renderiza a lista corrida de sempre.
  const renderPergunta = (q: Pergunta) => {
    const agg = (aggregates as Agregado[] | null)?.find((a) => a.question_id === q.id);
    return agg ? <PerguntaAgregada key={q.id} question={q} agg={agg} /> : null;
  };
  const perguntas = questions as Pergunta[];
  const semSecaoAgregado = perguntas.filter((q) => !q.section_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/testes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Voltar
        </Link>
        <AbasDeTeste versionId={versionId} hasInterpretation={version.has_interpretation} />
        <span />
      </div>

      {version.has_interpretation ? (
        <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Este teste tem interpretação (perfil, dimensões) — o resultado de cada resposta aparece nas Mentorias, não aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-black/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold">{version.title}</h1>
                {version.is_anonymous && (
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                    Anônimo
                  </span>
                )}
              </div>
              {lineage.length > 1 && (
                <Select
                  value={versionId}
                  onValueChange={(v) => navigate({ to: "/testes/$versionId/respostas", params: { versionId: v } })}
                >
                  <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {lineage.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {new Date(v.created_at).toLocaleDateString("pt-BR")} · {v.is_published ? "publicada" : "rascunho"}
                        {v.id === versionId ? " (atual)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <p className="text-sm">
              {invited === 0 ? (
                <span className="text-muted-foreground">Ainda não foi enviado a ninguém.</span>
              ) : (
                <>
                  <strong className="font-semibold">{responded}</strong> de <strong className="font-semibold">{invited}</strong> responderam
                  {missing > 0 && <span className="text-muted-foreground"> · faltam {missing}</span>}
                </>
              )}
            </p>
          </div>

          {locked ? (
            <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
              <Lock className="mx-auto size-8 text-muted-foreground" />
              <h2 className="mt-4 text-base font-medium">
                {responded} de {invited} responderam — o resultado abre com 3 respostas
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Teste anônimo: com menos de 3 respostas dá para adivinhar quem respondeu o quê por eliminação. A proteção vale para você também — nem pelo banco dá para contornar.
              </p>
            </div>
          ) : responded === 0 ? (
            <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
              <Inbox className="mx-auto size-8 text-muted-foreground" />
              <h2 className="mt-4 text-base font-medium">Nenhuma resposta ainda</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Assim que alguém responder, o resumo aparece aqui.</p>
            </div>
          ) : (
            <>
              {sections.length === 0 ? (
                perguntas.map((q) => renderPergunta(q))
              ) : (
                <>
                  {(sections as Secao[]).map((s) => {
                    const doSecao = perguntas.filter((q) => q.section_id === s.id);
                    if (doSecao.length === 0) return null;
                    return (
                      <div key={s.id} className="space-y-3">
                        <div>
                          <h2 className="text-base font-semibold">{s.title}</h2>
                          {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                        </div>
                        {doSecao.map((q) => renderPergunta(q))}
                      </div>
                    );
                  })}
                  {semSecaoAgregado.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-base font-semibold">Outras perguntas</h2>
                      {semSecaoAgregado.map((q) => renderPergunta(q))}
                    </div>
                  )}
                </>
              )}

              {respondents && respondents.length > 0 && (
                <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
                  <h2 className="mb-1 text-sm font-semibold">Respostas individuais</h2>
                  <ul className="divide-y divide-black/5">
                    {respondents.map((r) => (
                      <li key={r.response_id}>
                        <button
                          type="button"
                          onClick={() => setAberto(r.response_id)}
                          className="flex w-full items-center gap-3 py-3 text-left hover:opacity-70"
                        >
                          <Avatar url={r.avatar_url} nome={r.full_name} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{r.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Respondeu em {new Date(r.submitted_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}

      {aberto && <RespostaIndividualDialog responseId={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

function PerguntaAgregada({ question, agg }: { question: Pergunta; agg: Agregado }) {
  const Icon = TYPE_ICON[question.type];
  const maxDistribuicao = agg.type === "linear_scale" ? Math.max(1, ...agg.distribuicao.map((d) => d.count)) : 1;
  return (
    <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-black/5">
      <div className="flex items-start gap-2">
        {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
        <p className="text-sm font-medium">{question.prompt}</p>
      </div>

      {(agg.type === "multiple_choice" || agg.type === "checkboxes") && (
        agg.total_respondentes === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguém respondeu esta pergunta ainda.</p>
        ) : (
          <div className="space-y-2">
            {agg.opcoes.map((o) => (
              <div key={o.option_id} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs text-muted-foreground" title={o.label}>{o.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${o.pct}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">{o.count} ({o.pct}%)</span>
              </div>
            ))}
          </div>
        )
      )}

      {agg.type === "linear_scale" && (
        agg.media === null ? (
          <p className="text-xs text-muted-foreground">Ninguém respondeu esta pergunta ainda.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              <strong className="text-base font-semibold">{agg.media}</strong>{" "}
              <span className="text-muted-foreground">média · {agg.total_respondentes} resposta{agg.total_respondentes === 1 ? "" : "s"}</span>
            </p>
            <div className="space-y-1.5">
              {agg.distribuicao.map((d) => (
                <div key={d.valor} className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">{d.valor}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(d.count / maxDistribuicao) * 100}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-xs font-medium tabular-nums">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {agg.type === "short_text" && (
        agg.textos.length > 0 ? (
          <ul className="space-y-2">
            {agg.textos.map((t) => (
              <li key={t.response_id} className="rounded-lg bg-muted/40 p-3 text-sm ring-1 ring-black/5">{t.text}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Ninguém escreveu uma resposta ainda.</p>
        )
      )}
    </div>
  );
}

function RespostaIndividualDialog({ responseId, onClose }: { responseId: string; onClose: () => void }) {
  const fn = useServerFn(getIndividualResponse);
  const { data, isLoading } = useQuery({
    queryKey: ["individual-response", responseId],
    queryFn: () => fn({ data: { response_id: responseId } }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.person?.full_name ?? "Resposta"}</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-4">
            {data.questions.map((q) => (
              <div key={q.id} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{q.prompt}</p>
                <p className="text-sm">{formatarResposta(q)}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatarResposta(q: { type: string; question_options: Array<{ id: string; label: string }>; payload: unknown }): string {
  if (q.payload == null) return "— não respondida —";
  const payload = q.payload as Record<string, unknown>;
  if (q.type === "multiple_choice") {
    const opt = q.question_options.find((o) => o.id === payload.option_id);
    return opt?.label ?? "—";
  }
  if (q.type === "checkboxes") {
    const ids = Array.isArray(payload.option_ids) ? (payload.option_ids as unknown[]) : [];
    const labels = q.question_options.filter((o) => ids.includes(o.id)).map((o) => o.label);
    return labels.length > 0 ? labels.join(", ") : "—";
  }
  if (q.type === "linear_scale") {
    return typeof payload.value === "number" ? String(payload.value) : "—";
  }
  if (q.type === "short_text") {
    return typeof payload.text === "string" && payload.text ? payload.text : "—";
  }
  return "—";
}
