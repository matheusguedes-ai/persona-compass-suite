import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStudentArea } from "@/lib/student.functions";
import { StatusBadge } from "@/components/status-badge";
import { FileText, MailQuestion } from "lucide-react";

export const Route = createFileRoute("/aluno/")({
  validateSearch: (s: Record<string, unknown>) => ({
    ver: typeof s.ver === "string" ? s.ver : undefined,
  }),
  head: () => ({ meta: [{ title: "Meus resultados" }, { name: "robots", content: "noindex" }] }),
  component: MeusResultados,
});

type Resposta = {
  id: string; status: string; submitted_at: string | null; created_at: string;
  assessment_response_id: string | null; attempt: number;
  test_versions: { title: string } | null;
};

function MeusResultados() {
  const { ver } = Route.useSearch();
  const fn = useServerFn(getStudentArea);
  const { data, isLoading } = useQuery({
    queryKey: ["student-area", ver ?? null],
    queryFn: () => fn({ data: { preview_person_id: ver ?? null } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!data?.vinculado) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
        <MailQuestion className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-base font-medium">Ainda não encontramos seu cadastro</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Sua conta precisa usar o <span className="font-medium text-foreground">mesmo email</span> que
          seu mentor cadastrou. Se você entrou com outro, saia e entre de novo com o email correto —
          ou peça ao seu mentor para conferir o cadastro.
        </p>
      </div>
    );
  }

  const respostas = (data.respostas ?? []) as Resposta[];
  const avulsas = respostas.filter((r) => !r.assessment_response_id);
  const baterias = data.baterias ?? [];

  const linhas = [
    ...baterias.map((b) => {
      const partes = respostas.filter((r) => r.assessment_response_id === b.id);
      const feitas = partes.filter((p) => p.submitted_at).length;
      return {
        id: b.id,
        titulo: partes.length > 0 ? `Bateria — ${partes.length} testes` : "Bateria",
        detalhe: partes.map((p) => p.test_versions?.title).filter(Boolean).join(" · "),
        concluido: !!b.submitted_at,
        parcial: feitas > 0 && feitas < partes.length ? `${feitas} de ${partes.length}` : null,
        quando: b.submitted_at ?? b.created_at,
        tentativa: b.attempt ?? 1,
        link: b.submitted_at ? `/relatorio-bateria/${b.id}` : `/bateria/${b.id}`,
        pendente: !b.submitted_at,
      };
    }),
    ...avulsas.map((r) => ({
      id: r.id,
      titulo: r.test_versions?.title ?? "Teste",
      detalhe: "",
      concluido: !!r.submitted_at,
      parcial: null,
      quando: r.submitted_at ?? r.created_at,
      tentativa: r.attempt ?? 1,
      link: r.submitted_at ? `/relatorio/${r.id}` : `/responder/${r.id}`,
      pendente: !r.submitted_at,
    })),
  ].sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {data.nome?.split(" ")[0] ?? "tudo bem"}!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui ficam os testes que você respondeu e os que ainda estão abertos.
        </p>
      </div>

      {linhas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
          <FileText className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-base font-medium">Nenhum teste ainda</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando seu mentor enviar um inventário, ele aparece aqui.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
          <ul className="divide-y divide-black/5">
            {linhas.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{l.titulo}</span>
                    {l.tentativa > 1 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                        {l.tentativa}ª aplicação
                      </span>
                    )}
                  </div>
                  {l.detalhe && <p className="truncate text-xs text-muted-foreground">{l.detalhe}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {l.concluido ? "Concluído em " : "Enviado em "}
                    {new Date(l.quando).toLocaleDateString("pt-BR")}
                    {l.parcial && ` · ${l.parcial} respondidos`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={l.concluido ? "concluido" : "pendente"} />
                  <a
                    href={l.link}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    {l.pendente ? "Responder" : "Ver relatório"}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
