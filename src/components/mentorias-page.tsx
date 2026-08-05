/**
 * Tela de Mentorias — lista de pacotes ativos.
 *
 * Cada linha mostra a conta em três números: realizadas · agendadas · faltam
 * agendar. Calculada no servidor (`listMentorias`), nunca digitada aqui —
 * mesmo princípio que já regia a fila de devolutivas.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMentorias, criarMentoria } from "@/lib/mentorias.functions";
import { listarLinksAtivos } from "@/lib/agendamento.functions";
import { listarPessoasParaEscolher } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, CalendarClock, ArrowRight, Link2 } from "lucide-react";
import { toast } from "sonner";

function dataBr(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function MentoriasPage() {
  const qc = useQueryClient();
  const listaFn = useServerFn(listMentorias);
  const criarFn = useServerFn(criarMentoria);
  const pessoasFn = useServerFn(listarPessoasParaEscolher);
  const linksFn = useServerFn(listarLinksAtivos);

  const { data, isLoading, error } = useQuery({ queryKey: ["mentorias"], queryFn: () => listaFn() });

  const [aberto, setAberto] = useState(false);
  const [personId, setPersonId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [sessoes, setSessoes] = useState("4");
  const [observacoes, setObservacoes] = useState("");
  const [linkId, setLinkId] = useState("");
  const { data: pessoasData } = useQuery({
    queryKey: ["pessoas-para-escolher"], queryFn: () => pessoasFn(), enabled: aberto,
  });
  const { data: linksData } = useQuery({
    queryKey: ["links-ativos"], queryFn: () => linksFn(), enabled: aberto,
  });

  const criar = useMutation({
    mutationFn: () =>
      criarFn({
        data: {
          person_id: personId,
          titulo: titulo.trim() || undefined,
          sessoes_contratadas: Number(sessoes),
          observacoes: observacoes.trim() || undefined,
          link_id: linkId || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Mentoria criada.");
      setAberto(false); setPersonId(""); setTitulo(""); setSessoes("4"); setObservacoes(""); setLinkId("");
      qc.invalidateQueries({ queryKey: ["mentorias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mentorias = data?.mentorias ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mentorias</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pacotes de sessões com cada aluno — agende, conclua e escreva o resumo.
          </p>
        </div>
        {!error && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/mentorias/agendamento"><Link2 className="size-4" /> Agendamento automático</Link>
            </Button>
            <Button onClick={() => setAberto(true)}>
              <Plus className="size-4" /> Criar
            </Button>
          </div>
        )}
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {error && (
        <div className="rounded-xl bg-destructive/10 p-8 text-center">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        </div>
      )}

      {!isLoading && !error && mentorias.length === 0 && (
        <div className="rounded-xl bg-muted/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma mentoria ainda. Crie a primeira escolhendo o aluno e quantas sessões vocês combinaram.
          </p>
        </div>
      )}

      {!error && (
      <ul className="divide-y divide-black/5 rounded-xl border border-black/5 bg-card">
        {mentorias.map((m) => (
          <li key={m.id}>
            <Link
              to="/mentorias/$id"
              params={{ id: m.id }}
              className="group flex flex-wrap items-center gap-4 p-4 hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.person_name}
                  {m.titulo && <span className="font-normal text-muted-foreground"> · {m.titulo}</span>}
                </p>
                {m.proxima_sessao && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3" /> próxima em {dataBr(m.proxima_sessao)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs">
                <span><strong className="tabular-nums">{m.realizadas}</strong> realizadas</span>
                <span><strong className="tabular-nums">{m.agendadas}</strong> agendadas</span>
                <span><strong className="tabular-nums">{m.faltam}</strong> a agendar</span>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-60" />
            </Link>
          </li>
        ))}
      </ul>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar mentoria</DialogTitle>
            <DialogDescription>Aluno, quantidade de sessões e o que quiser anotar. Sem modelo pronto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Aluno</label>
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Escolha uma pessoa…</option>
                {(pessoasData?.pessoas ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Título (opcional)</label>
              <Input
                value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1.5"
                placeholder="Ex.: Mentoria de comunicação"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Quantas sessões</label>
              <Input
                type="number" min={1} max={999} value={sessoes}
                onChange={(e) => setSessoes(e.target.value)} className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className="mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-medium">Link de agendamento (opcional)</label>
              <select
                value={linkId}
                onChange={(e) => setLinkId(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Sem link — só você agenda</option>
                {(linksData?.links ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.titulo} ({l.duracao_min} min)</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Com um link escolhido, o aluno pode agendar sozinho pelo próprio painel.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button
              onClick={() => criar.mutate()}
              disabled={!personId || !sessoes || Number(sessoes) < 1 || criar.isPending}
            >
              {criar.isPending ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
