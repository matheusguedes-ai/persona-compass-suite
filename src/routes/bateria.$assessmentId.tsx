import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight, LayoutDashboard } from "lucide-react";
import { ResponseForm } from "@/components/response-form";
import { CriarContaNoFim } from "@/components/criar-conta-no-fim";
import { useApplyBrand, type Brand } from "@/lib/brand";

export const Route = createFileRoute("/bateria/$assessmentId")({
  head: () => ({ meta: [{ title: "Bateria de testes" }, { name: "robots", content: "noindex" }] }),
  component: BateriaPage,
});

type Part = { response_id: string; title: string; instrument_id: string | null; sort: number; submitted: boolean };
type Payload = { brand?: Brand | null; person_name: string | null; parts: Part[]; current: string | null; total: number; done: number; status: string };

function BateriaPage() {
  const { assessmentId } = Route.useParams();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [justFinished, setJustFinished] = useState<number | null>(null);
  useApplyBrand(payload?.brand);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/public/assessment/${assessmentId}`);
      if (!r.ok) { setError("Bateria não encontrada."); return null; }
      const json = (await r.json()) as Payload;
      setPayload(json);
      return json;
    } catch {
      setError("Falha de conexão. Tente novamente.");
      return null;
    }
  }, [assessmentId]);

  useEffect(() => { void load(); }, [load]);

  if (error) return <Shell><p className="text-sm text-muted-foreground">{error}</p></Shell>;
  if (!payload) return <Shell><p className="text-sm text-muted-foreground">Carregando…</p></Shell>;

  const allDone = payload.total > 0 && payload.done === payload.total;
  // O relatório da bateria reúne todos os inventários respondidos num só documento.
  const hasReport = payload.done > 0;

  if (allDone && !activeId) {
    return (
      <Shell>
        <div className="text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
          <h1 className="mt-3 text-xl font-semibold">Todas as respostas foram enviadas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Obrigado por concluir a bateria de testes.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {hasReport && (
              <Button asChild>
                <Link to="/relatorio-bateria/$assessmentId" params={{ assessmentId }}>Ver relatório completo</Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href="/aluno">
                <LayoutDashboard className="size-3.5" /> Ir para o meu painel
              </a>
            </Button>
          </div>
        </div>
        {/* Âncora: qualquer etapa serve para achar a pessoa. */}
        {payload.parts[0] && (
          <div className="mt-4">
            <CriarContaNoFim responseId={payload.parts[0].response_id} />
          </div>
        )}
      </Shell>
    );
  }

  if (activeId) {
    const idx = payload.parts.findIndex((p) => p.response_id === activeId);
    return (
      <Shell>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Etapa {idx + 1} de {payload.total}
        </p>
        <ResponseForm
          responseId={activeId}
          submitLabel="Concluir etapa"
          onAlreadySubmitted={async () => { setActiveId(null); await load(); }}
          onSubmitted={async () => {
            // Não emenda sozinho no próximo. Depois de 28 blocos a pessoa
            // precisa poder escolher se continua agora ou volta depois — e
            // emendar à força é o que faz a segunda etapa ser respondida no
            // automático.
            setActiveId(null);
            setJustFinished(idx + 1);
            await load();
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">Bateria de testes</h1>
      {payload.person_name && (
        <p className="mt-1 text-sm text-muted-foreground">Respondendo como: <strong>{payload.person_name}</strong></p>
      )}
      {justFinished != null && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-4" />
            Etapa {justFinished} de {payload.total} concluída.
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            {payload.current
              ? "Você pode seguir agora ou voltar depois — o que já respondeu está salvo."
              : "Você respondeu todas as etapas."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {payload.current && (
              <Button onClick={() => setActiveId(payload.current)}>
                Fazer o próximo teste <ArrowRight className="size-3.5" />
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href="/aluno">
                <LayoutDashboard className="size-3.5" /> Ir para o meu painel
              </a>
            </Button>
          </div>
          {payload.current && (
            <p className="mt-3 text-xs text-emerald-700">
              Para responder aos poucos, entre no seu painel: é lá que ficam os testes liberados
              para você, com o que já foi respondido guardado.
            </p>
          )}
        </div>
      )}
      <ol className="mt-6 space-y-2">
        {payload.parts.map((p, i) => {
          const isCurrent = p.response_id === payload.current;
          return (
            <li key={p.response_id} className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-black/5">
              {p.submitted
                ? <CheckCircle2 className="size-4 text-emerald-500" />
                : isCurrent ? <ArrowRight className="size-4 text-primary" /> : <Circle className="size-4 text-muted-foreground" />}
              <span className="flex-1 text-sm font-medium">{i + 1}. {p.title}</span>
              <span className="text-xs text-muted-foreground">
                {p.submitted ? "Concluída" : isCurrent ? "Atual" : "Pendente"}
              </span>
            </li>
          );
        })}
      </ol>
      <Button
        className="mt-6 w-full"
        disabled={!payload.current}
        onClick={() => setActiveId(payload.current)}
      >
        Continuar de onde parei
      </Button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl p-6">{children}</div>;
}
