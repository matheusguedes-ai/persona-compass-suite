import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTestVersions, duplicateTemplate, deleteTestVersion } from "@/lib/tests.functions";
import { listInstruments } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Copy, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/testes/")({
  head: () => ({
    meta: [
      { title: "Testes — Métrica Humana" },
      { name: "description", content: "Catálogo de testes: DISC, Big Five, MBTI, Temperamentos, VAK, QI." },
    ],
  }),
  component: TestesPage,
});

function TestesPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const listVersionsFn = useServerFn(listTestVersions);
  const listInstrFn = useServerFn(listInstruments);
  const dupFn = useServerFn(duplicateTemplate);
  const delFn = useServerFn(deleteTestVersion);

  const { data: instruments = [] } = useQuery({ queryKey: ["instruments"], queryFn: () => listInstrFn() });
  const { data: versions = [] } = useQuery({ queryKey: ["test-versions"], queryFn: () => listVersionsFn({ data: {} }) });

  const dup = useMutation({
    mutationFn: (id: string) => dupFn({ data: { template_version_id: id } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["test-versions"] });
      toast.success("Cópia criada — abra para editar");
      nav({ to: "/testes/$versionId/editar", params: { versionId: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["test-versions"] }); toast.success("Excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Testes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Duplique um template para criar sua própria versão editável (perguntas, opções, dimensões e resultados).
        </p>
      </div>

      {instruments.map((inst) => {
        const insts = versions.filter((v) => v.instrument_id === inst.id);
        const templates = insts.filter((v) => v.is_template);
        const mine = insts.filter((v) => !v.is_template);
        return (
          <section key={inst.id} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{inst.name}</h2>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{inst.short_name}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((v) => (
                <div key={v.id} className="flex flex-col rounded-xl bg-card p-4 ring-1 ring-black/5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Template</span>
                  </div>
                  <h3 className="mt-2 text-base font-medium">{v.title}</h3>
                  {v.description && <p className="mt-1 text-xs text-muted-foreground">{v.description}</p>}
                  <div className="mt-4 flex items-center justify-end">
                    <Button size="sm" onClick={() => dup.mutate(v.id)} disabled={dup.isPending}>
                      <Copy className="size-3" /> Duplicar para editar
                    </Button>
                  </div>
                </div>
              ))}
              {mine.map((v) => (
                <div key={v.id} className="flex flex-col rounded-xl bg-card p-4 ring-1 ring-accent/40 ring-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${v.is_published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {v.is_published ? "Publicado" : "Rascunho"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">minha versão</span>
                  </div>
                  <h3 className="mt-2 text-base font-medium">{v.title}</h3>
                  {v.description && <p className="mt-1 text-xs text-muted-foreground">{v.description}</p>}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(v.id)}>
                      <Trash2 className="size-3" /> Excluir
                    </Button>
                    <Button size="sm" onClick={() => nav({ to: "/testes/$versionId/editar", params: { versionId: v.id } })}>
                      <Pencil className="size-3" /> Editar
                    </Button>
                  </div>
                </div>
              ))}
              {insts.length === 0 && (
                <div className="col-span-full flex items-center gap-2 rounded-lg bg-muted/40 p-6 text-sm text-muted-foreground ring-1 ring-black/5">
                  <FileText className="size-4" /> Nenhuma versão ainda para este instrumento.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}