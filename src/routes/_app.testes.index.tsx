import { mensagemDeErro } from "@/lib/erro-legivel";
import { AbasDeTestes } from "@/components/abas-testes";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listTestVersions, duplicateVersion, deleteTestVersion, createTestVersion } from "@/lib/tests.functions";
import { listInstruments } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, GitBranch, Pencil, Trash2, FileText, Plus } from "lucide-react";
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
  const dupFn = useServerFn(duplicateVersion);
  const delFn = useServerFn(deleteTestVersion);
  const createFn = useServerFn(createTestVersion);

  const { data: instruments = [] } = useQuery({ queryKey: ["instruments"], queryFn: () => listInstrFn() });
  const { data: versions = [] } = useQuery({ queryKey: ["test-versions"], queryFn: () => listVersionsFn({ data: {} }) });

  const dup = useMutation({
    mutationFn: (v: { id: string; title?: string }) =>
      dupFn({ data: { source_version_id: v.id, title: v.title?.trim() || undefined } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["test-versions"] });
      toast.success("Cópia criada — abra para editar");
      setCopiaAberto(false); setOrigemId(""); setCopiaTitulo("");
      nav({ to: "/testes/$versionId/editar", params: { versionId: row.id } });
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["test-versions"] }); toast.success("Excluído"); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const [criarAberto, setCriarAberto] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoAnonimo, setNovoAnonimo] = useState(false);
  const criar = useMutation({
    mutationFn: () => createFn({ data: { title: novoTitulo.trim(), description: novaDescricao.trim() || null, is_anonymous: novoAnonimo } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["test-versions"] });
      toast.success("Teste criado — comece adicionando perguntas");
      setCriarAberto(false);
      setNovoTitulo(""); setNovaDescricao(""); setNovoAnonimo(false);
      nav({ to: "/testes/$versionId/editar", params: { versionId: row.id } });
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const [copiaAberto, setCopiaAberto] = useState(false);
  const [origemId, setOrigemId] = useState("");
  const [copiaTitulo, setCopiaTitulo] = useState("");
  const modelos = versions.filter((v) => v.is_template);
  const meus = versions.filter((v) => !v.is_template);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Testes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite o modelo direto, duplique para manter o original intacto, ou crie um teste seu do zero.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog
            open={copiaAberto}
            onOpenChange={(v) => { setCopiaAberto(v); if (!v) { setOrigemId(""); setCopiaTitulo(""); } }}
          >
            <DialogTrigger asChild>
              <Button variant="outline"><GitBranch className="size-4" /> A partir de um existente</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar a partir de um teste existente</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Teste de origem</Label>
                  <Select
                    value={origemId}
                    onValueChange={(v) => {
                      setOrigemId(v);
                      const origem = versions.find((x) => x.id === v);
                      if (origem) setCopiaTitulo(`Cópia de ${origem.title}`);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Escolha um teste" /></SelectTrigger>
                    <SelectContent>
                      {modelos.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Modelos da plataforma</SelectLabel>
                          {modelos.map((v) => (
                            <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {meus.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Meus testes</SelectLabel>
                          {meus.map((v) => (
                            <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {origemId && (
                  <div className="space-y-2">
                    <Label>Nome da cópia</Label>
                    <Input value={copiaTitulo} onChange={(e) => setCopiaTitulo(e.target.value)} maxLength={160} />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  A cópia nasce como rascunho, só sua — o teste de origem continua exatamente como está, sem
                  nenhuma resposta. Perguntas, opções, seções, dimensões e faixas de resultado são copiadas
                  quando existirem; convites e respostas nunca são.
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCopiaAberto(false)}>Cancelar</Button>
                <Button
                  onClick={() => dup.mutate({ id: origemId, title: copiaTitulo })}
                  disabled={!origemId || dup.isPending}
                >
                  {dup.isPending ? "Criando…" : "Criar cópia"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={criarAberto} onOpenChange={setCriarAberto}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> Criar teste</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar teste</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} maxLength={160} placeholder="Ex.: Pesquisa de satisfação — Turma 3" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} maxLength={1000} rows={2} placeholder="Do que se trata." />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-black/5 p-3">
                  <div>
                    <p className="text-sm font-medium">Anônimo</p>
                    <p className="text-[11px] text-muted-foreground">
                      A plataforma não guarda quem respondeu — nem você vai conseguir ver depois. Só dá pra
                      escolher agora; não tem como mudar mais tarde.
                    </p>
                  </div>
                  <Switch checked={novoAnonimo} onCheckedChange={setNovoAnonimo} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Nasce como rascunho — ninguém vê até você publicar. Você adiciona as perguntas na tela seguinte.
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCriarAberto(false)}>Cancelar</Button>
                <Button onClick={() => criar.mutate()} disabled={!novoTitulo.trim() || criar.isPending}>
                  {criar.isPending ? "Criando…" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <AbasDeTestes />

      {instruments.map((inst) => {
        const insts = versions.filter((v) => v.instrument_id === inst.id);
        return (
          <section key={inst.id} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{inst.name}</h2>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{inst.short_name}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {insts.map((v) => {
                const emUso = (v.respostas ?? 0) > 0;
                return (
                  <div
                    key={v.id}
                    className={`flex flex-col rounded-xl bg-card p-4 ring-1 ring-black/5 ${v.is_template ? "" : "ring-2 ring-accent/40"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {v.is_template ? "Modelo" : "Minha versão"}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${v.is_published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {v.is_published ? "Publicado" : "Rascunho"}
                      </span>
                      {v.is_anonymous && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                          Anônimo
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-base font-medium">{v.title}</h3>
                    {v.description && <p className="mt-1 text-xs text-muted-foreground">{v.description}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {emUso
                        ? `Respondido ${v.respostas} vez${v.respostas === 1 ? "" : "es"}`
                        : "Ainda não foi respondido"}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      {v.can_edit && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" title={emUso ? "Não dá para apagar um teste já respondido" : "Apagar esta versão"}>
                              <Trash2 className="size-3" /> Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {emUso ? "Não dá para excluir" : `Excluir “${v.title}”?`}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {emUso ? (
                                  <>
                                    Este teste já foi respondido <strong>{v.respostas} vez{v.respostas === 1 ? "" : "es"}</strong>.
                                    Apagar levaria junto as respostas e os relatórios. Se quiser parar de usá-lo,
                                    abra em <strong>Editar</strong> e desmarque “publicado” — ele some dos envios e o
                                    histórico continua de pé.
                                  </>
                                ) : (
                                  <>As perguntas, opções, dimensões e textos de resultado desta versão serão removidos. Não dá para desfazer.</>
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{emUso ? "Entendi" : "Cancelar"}</AlertDialogCancel>
                              {!emUso && (
                                <AlertDialogAction onClick={() => del.mutate(v.id)}>Excluir</AlertDialogAction>
                              )}
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <Button size="sm" variant="outline" onClick={() => dup.mutate({ id: v.id })} disabled={dup.isPending}>
                        <Copy className="size-3" /> Duplicar
                      </Button>
                      {v.can_edit && (
                        <Button size="sm" onClick={() => nav({ to: "/testes/$versionId/editar", params: { versionId: v.id } })}>
                          <Pencil className="size-3" /> Editar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
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