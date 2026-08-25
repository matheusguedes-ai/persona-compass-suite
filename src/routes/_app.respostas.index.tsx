/**
 * #280 — aba Respostas: central de acesso e download. NÃO recria o painel de
 * respostas do construtor (#212 F2) nem a devolutiva/relatório dos
 * templates — lista os testes com resposta e leva a quem já existe. O que
 * ela acrescenta de fato é o download (planilha completa e PDF individual).
 */
import { mensagemDeErro } from "@/lib/erro-legivel";
import { AbasDeTestes } from "@/components/abas-testes";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listRespostasPorTeste,
  listRespondentesDoTeste,
  baixarPlanilhaDeRespostas,
} from "@/lib/exportar-respostas.functions";
import { getMyMembership } from "@/lib/team.functions";
import { Avatar } from "@/components/avatar-upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText, Inbox, Lock, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/respostas/")({
  head: () => ({
    meta: [
      { title: "Respostas — Métrica Humana" },
      { name: "description", content: "Testes com resposta: acesso e download." },
    ],
  }),
  component: RespostasIndexPage,
});

function baixarArquivo(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

type TesteComResposta = {
  version_id: string;
  title: string;
  is_template: boolean;
  is_anonymous: boolean;
  version_created_at: string;
  respostas: number;
  ultima_resposta: string;
};

function RespostasIndexPage() {
  const listFn = useServerFn(listRespostasPorTeste);
  const { data = [], isLoading } = useQuery({
    queryKey: ["respostas-por-teste"],
    queryFn: () => listFn() as Promise<TesteComResposta[]>,
  });

  const membershipFn = useServerFn(getMyMembership);
  const { data: membership } = useQuery({
    queryKey: ["my-membership"],
    queryFn: () => membershipFn(),
    staleTime: 300_000,
  });
  const souDono = (membership?.kind ?? "owner") === "owner";

  const [respondentesAberto, setRespondentesAberto] = useState<string | null>(null);

  const planilhaFn = useServerFn(baixarPlanilhaDeRespostas);
  const baixarPlanilha = useMutation({
    mutationFn: async (versionId: string) => {
      const r = await planilhaFn({ data: { version_id: versionId } });
      // Carregado só no clique: mesmo padrão de exportar-pessoas.tsx — a
      // biblioteca é pesada e a maioria das visitas nunca baixa nada.
      const XLSX = await import("xlsx");
      const aba = XLSX.utils.json_to_sheet(r.linhas);
      const livro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(livro, aba, "Respostas");
      const buf = XLSX.write(livro, { bookType: "xlsx", type: "array" });
      baixarArquivo(
        r.nome_arquivo,
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      return r.linhas.length;
    },
    onSuccess: (n) => toast.success(`${n} ${n === 1 ? "resposta baixada" : "respostas baixadas"}.`),
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Respostas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.length} {data.length === 1 ? "teste com resposta" : "testes com resposta"}.
          </p>
        </div>
        <AbasDeTestes />
      </div>

      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-black/5">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-black/5 bg-muted/50">
            <tr>
              <th className="px-6 py-3 font-medium text-muted-foreground">Teste</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Tipo</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Respostas</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Última resposta</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {data.map((v) => {
              const bloqueadoAnonimo = v.is_anonymous && v.respostas < 3;
              return (
                <tr key={v.version_id} className="hover:bg-muted/40">
                  <td className="px-6 py-4">
                    <p className="font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      versão de {new Date(v.version_created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {v.is_template ? "Modelo" : "Minha versão"}
                    </span>
                    {v.is_anonymous && (
                      <span className="ml-1 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        Anônimo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{v.respostas}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(v.ultima_resposta).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {v.is_template ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRespondentesAberto(v.version_id)}
                      >
                        <Users className="size-3" /> Ver quem respondeu
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          to="/testes/$versionId/respostas"
                          params={{ versionId: v.version_id }}
                        >
                          <FileText className="size-3" /> Ver respostas
                        </Link>
                      </Button>
                    )}
                    {souDono && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={bloqueadoAnonimo || baixarPlanilha.isPending}
                        title={
                          bloqueadoAnonimo
                            ? "Teste anônimo — a planilha libera com 3 respostas"
                            : undefined
                        }
                        onClick={() => baixarPlanilha.mutate(v.version_id)}
                      >
                        {bloqueadoAnonimo ? (
                          <Lock className="size-3" />
                        ) : (
                          <Download className="size-3" />
                        )}{" "}
                        Baixar planilha
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {isLoading ? (
                    "Carregando…"
                  ) : (
                    <span className="flex flex-col items-center gap-2">
                      <Inbox className="size-8 text-muted-foreground" />
                      Nenhum teste com resposta ainda.
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {respondentesAberto && (
        <RespondentesDialog
          versionId={respondentesAberto}
          onClose={() => setRespondentesAberto(null)}
        />
      )}
    </div>
  );
}

function RespondentesDialog({ versionId, onClose }: { versionId: string; onClose: () => void }) {
  const fn = useServerFn(listRespondentesDoTeste);
  const { data, isLoading } = useQuery({
    queryKey: ["respondentes-do-teste", versionId],
    queryFn: () => fn({ data: { version_id: versionId } }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.title ?? "Quem respondeu"}</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : data.respondentes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Ninguém respondeu ainda.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {data.respondentes.map((r) => (
              <li key={r.response_id} className="flex items-center gap-3 py-3">
                <Avatar url={r.avatar_url} nome={r.full_name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Respondeu em {new Date(r.submitted_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  {r.assessment_response_id ? (
                    <Link
                      to="/relatorio-bateria/$assessmentId"
                      params={{ assessmentId: r.assessment_response_id }}
                    >
                      <FileText className="size-3" /> Relatório
                    </Link>
                  ) : (
                    <Link to="/relatorio/$responseId" params={{ responseId: r.response_id }}>
                      <FileText className="size-3" /> Relatório
                    </Link>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
