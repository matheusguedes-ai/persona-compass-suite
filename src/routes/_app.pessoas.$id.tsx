import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ROLE_LABEL, type PersonRole } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, FileText, Link as LinkIcon, Mail, RotateCcw, Send, Trash2, Eye } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPerson, deletePerson } from "@/lib/data.functions";
import { authorizeRetake, authorizeRetakeAssessment } from "@/lib/tests.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pessoas/$id")({
  head: () => ({
    meta: [
      { title: "Perfil — Métrica Humana" },
      { name: "description", content: "Perfil do avaliado com testes enviados e histórico." },
    ],
  }),
  component: PersonProfile,
  errorComponent: ({ error }) => (
    <div className="grid place-items-center py-24 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="grid place-items-center py-24 text-sm text-muted-foreground">Pessoa não encontrada.</div>
  ),
});

function PersonProfile() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const getFn = useServerFn(getPerson);
  const delFn = useServerFn(deletePerson);
  const { data, isLoading, error } = useQuery({
    queryKey: ["person", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
      toast.success("Pessoa removida");
      nav({ to: "/pessoas" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retakeFn = useServerFn(authorizeRetake);
  const retakeAssessmentFn = useServerFn(authorizeRetakeAssessment);
  const retake = useMutation({
    mutationFn: (item: HistoryItem) =>
      item.assessmentId
        ? retakeAssessmentFn({ data: { assessment_id: item.assessmentId } })
        : retakeFn({ data: { response_id: item.responseId! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person", id] });
      toast.success("Novo teste liberado. O link já aparece no histórico.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (error || !data) return <div className="py-12 text-center text-sm text-destructive">{(error as Error)?.message ?? "Erro"}</div>;

  const { person, groups, responses } = data;
  const history = buildHistory(responses ?? []);

  return (
    <div className="space-y-6">
      <Link to="/pessoas" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Voltar para pessoas
      </Link>

      <div className="flex items-start justify-between rounded-xl bg-card p-6 ring-1 ring-black/5">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-600 ring-1 ring-black/5">
            {person.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{person.full_name}</h1>
            <p className="text-sm text-muted-foreground">{person.email}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground ring-1 ring-black/5">
                {ROLE_LABEL[person.role as PersonRole]}
              </span>
              {person.phone && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground ring-1 ring-black/5">{person.phone}</span>}
              {person.profession && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground ring-1 ring-black/5">{person.profession}</span>}
              {person.role_at_company && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground ring-1 ring-black/5">{person.role_at_company}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${person.email}`}><Mail className="size-4" /> Enviar email</a>
          </Button>
          <Button asChild size="sm">
            <Link to="/envios/novo" search={{ personId: person.id, groupId: undefined }}><Send className="size-4" /> Enviar teste</Link>
            </Button>
            <Button asChild variant="outline">
              <a href={`/aluno?ver=${person.id}`} title="Abrir a plataforma como esta pessoa enxerga">
                <Eye className="size-4" /> Ver como aluno
              </a>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={del.isPending}>
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover pessoa</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja remover <strong>{person.full_name}</strong>? Todos os vínculos com grupos e respostas serão perdidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => del.mutate()}>Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="relatorios">
            Relatórios{history.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{history.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <InfoBox label="Telefone" value={person.phone} />
            <InfoBox label="Profissão" value={person.profession} />
            <InfoBox label="Cargo" value={person.role_at_company} />
            <InfoBox label="Cadastrada em" value={new Date(person.created_at).toLocaleDateString("pt-BR")} />
          </div>
          {person.notes && (
            <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Observações</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{person.notes}</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="relatorios" className="mt-4">
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
            {history.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Esta pessoa ainda não respondeu nenhum teste.</p>
                <Button asChild size="sm" variant="outline" className="mt-4">
                  <Link to="/envios/novo" search={{ personId: person.id, groupId: undefined }}>
                    <Send className="size-4" /> Enviar um teste
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {history.map((item) => (
                  <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                      {item.title}
                      {item.attempt > 1 && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {item.attempt}ª aplicação
                        </span>
                      )}
                    </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.done === item.total
                          ? `Respondido em ${formatDate(item.date)}`
                          : `${item.done} de ${item.total} respondidos${item.date ? ` · iniciado em ${formatDate(item.date)}` : ""}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-black/5 ${
                          item.done === item.total
                            ? "bg-emerald-50 text-emerald-700"
                            : item.done > 0
                              ? "bg-amber-50 text-amber-700"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.done === item.total ? "Concluído" : item.done > 0 ? "Parcial" : "Pendente"}
                      </span>
                      {item.done > 0 &&
                        (item.assessmentId ? (
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/relatorio-bateria/$assessmentId" params={{ assessmentId: item.assessmentId }}>
                              <FileText className="size-3" /> Relatório
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/relatorio/$responseId" params={{ responseId: item.responseId! }}>
                              <FileText className="size-3" /> Relatório
                            </Link>
                          </Button>
                        ))}
                      {/* Só faz sentido refazer o que já foi concluído. */}
                      {item.done === item.total && (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => retake.mutate(item)}
                          disabled={retake.isPending}
                          title="Libera uma nova aplicação deste teste, mantendo a anterior no histórico"
                        >
                          <RotateCcw className="size-3" /> Refazer
                        </Button>
                      )}
                      {item.done < item.total && (
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            to={item.assessmentId ? "/bateria/$assessmentId" : "/responder/$responseId"}
                            params={item.assessmentId
                              ? { assessmentId: item.assessmentId }
                              : { responseId: item.responseId! }}
                          >
                            <LinkIcon className="size-3" /> Link
                          </Link>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="grupos" className="mt-4">
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
            {groups.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Esta pessoa ainda não pertence a nenhum grupo.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {groups.map((g) => {
                  const info = g.groups as { id: string; name: string; type: string } | null;
                  if (!info) return null;
                  return (
                    <li key={info.id} className="flex items-center justify-between px-6 py-3">
                      <span className="text-sm font-medium">{info.name}</span>
                      <Link to="/grupos/$id" params={{ id: info.id }} className="text-xs text-accent hover:underline">Abrir</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ResponseRow = {
  id: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  assessment_response_id: string | null;
  attempt?: number | null;
  test_versions: { title: string; instrument_id: string } | null;
};

type HistoryItem = {
  key: string;
  title: string;
  date: string | null;
  done: number;
  total: number;
  assessmentId: string | null;
  responseId: string | null;
  attempt: number;
};

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

/**
 * Monta o histórico: cada bateria vira UMA linha (o relatório dela é unificado)
 * e cada teste avulso vira a sua própria linha. Mais recentes primeiro.
 */
function buildHistory(rows: ResponseRow[]): HistoryItem[] {
  const batteries = new Map<string, ResponseRow[]>();
  const singles: ResponseRow[] = [];
  for (const r of rows) {
    if (r.assessment_response_id) {
      const list = batteries.get(r.assessment_response_id) ?? [];
      list.push(r);
      batteries.set(r.assessment_response_id, list);
    } else {
      singles.push(r);
    }
  }

  const items: HistoryItem[] = [];
  for (const [assessmentId, parts] of batteries) {
    const done = parts.filter((p) => p.submitted_at).length;
    // Data da bateria: a última resposta enviada; sem nenhuma, quando foi criada.
    const dates = parts.map((p) => p.submitted_at).filter((d): d is string => !!d).sort();
    items.push({
      key: `b-${assessmentId}`,
      attempt: Math.max(...parts.map((p) => p.attempt ?? 1)),
      title: `Bateria — ${parts.length} ${parts.length === 1 ? "teste" : "testes"}`,
      date: dates.at(-1) ?? parts.map((p) => p.created_at).sort().at(0) ?? null,
      done,
      total: parts.length,
      assessmentId,
      responseId: null,
    });
  }
  for (const r of singles) {
    items.push({
      key: `r-${r.id}`,
      attempt: r.attempt ?? 1,
      title: r.test_versions?.title ?? "Teste",
      date: r.submitted_at ?? r.created_at,
      done: r.submitted_at ? 1 : 0,
      total: 1,
      assessmentId: null,
      responseId: r.id,
    });
  }
  return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

function InfoBox({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}