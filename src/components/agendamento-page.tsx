/**
 * Agendamento automático — disponibilidade + links (Fatia 4a).
 *
 * Duas abas: quando o professor atende (grade por dia da semana, mais de uma
 * faixa por dia) e os links que oferece (cada um com sua duração e regras).
 * O aluno usa o link em /agendar/$slug — sem login, ver docs/plano-mentorias-fatia4.md.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarDisponibilidade, criarFaixaDisponibilidade, atualizarFaixaDisponibilidade, removerFaixaDisponibilidade,
  listarLinks, criarLink, atualizarLink, removerLink,
} from "@/lib/agendamento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Copy, Link as LinkIcon, Clock } from "lucide-react";
import { toast } from "sonner";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function AgendamentoPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Agendamento automático</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina quando você atende e crie links para o aluno marcar sozinho — sem precisar de login.
        </p>
      </header>

      <Tabs defaultValue="links">
        <TabsList>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
        </TabsList>
        <TabsContent value="links" className="mt-4">
          <AbaLinks />
        </TabsContent>
        <TabsContent value="disponibilidade" className="mt-4">
          <AbaDisponibilidade />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Disponibilidade
// ============================================================

type Faixa = { id: string; dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean };

/**
 * Horário sugerido para a próxima faixa de um dia, calculado a partir das que
 * já existem — quem clica no + não parte de 00:00. Sem faixa ainda: manhã
 * padrão (9h-12h). Com faixa: começa 2h depois da última (o intervalo de
 * almoço) e dura 4h — para o caso do enunciado (9h-12h e depois 14h-18h) isso
 * cai certinho sem precisar editar nada.
 */
function faixaPadrao(doDia: Faixa[]): { hora_inicio: string; hora_fim: string } {
  if (doDia.length === 0) return { hora_inicio: "09:00", hora_fim: "12:00" };
  const paraTexto = (min: number) => {
    const c = Math.min(Math.max(min, 0), 23 * 60 + 59);
    return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
  };
  const [h, m] = doDia.map((f) => f.hora_fim.slice(0, 5)).sort().at(-1)!.split(":").map(Number);
  const ultimoFimMin = h * 60 + m;
  const inicioMin = ultimoFimMin + 120;
  if (inicioMin >= 23 * 60 + 59) return { hora_inicio: paraTexto(ultimoFimMin), hora_fim: paraTexto(ultimoFimMin + 60) };
  return { hora_inicio: paraTexto(inicioMin), hora_fim: paraTexto(inicioMin + 240) };
}

function AbaDisponibilidade() {
  const qc = useQueryClient();
  const listaFn = useServerFn(listarDisponibilidade);
  const criarFn = useServerFn(criarFaixaDisponibilidade);
  const atualizarFn = useServerFn(atualizarFaixaDisponibilidade);
  const removerFn = useServerFn(removerFaixaDisponibilidade);

  const { data, isLoading } = useQuery({ queryKey: ["mentoria-disponibilidade"], queryFn: () => listaFn() });
  const faixas = data?.faixas ?? [];

  const invalidar = () => qc.invalidateQueries({ queryKey: ["mentoria-disponibilidade"] });

  const criar = useMutation({
    mutationFn: (args: { dia_semana: number; hora_inicio: string; hora_fim: string }) => criarFn({ data: args }),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: (args: { id: string; hora_inicio?: string; hora_fim?: string; ativo?: boolean }) => atualizarFn({ data: args }),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: (id: string) => removerFn({ data: { id } }),
    onSuccess: () => { toast.success("Faixa removida."); invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Clique no <Plus className="inline size-3" /> ao lado do dia para abrir um horário. Um dia pode ter mais de
        uma faixa — manhã e tarde separadas, por exemplo.
      </p>
      <div className="divide-y divide-black/5 rounded-xl border border-black/5 bg-card">
        {DIAS.map((nome, dia) => {
          const doDia = faixas
            .filter((f) => f.dia_semana === dia)
            .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
          return (
            <div key={dia} className="flex flex-wrap items-start gap-x-4 gap-y-2 p-4">
              <p className="w-20 shrink-0 pt-1.5 text-sm font-medium">{nome}</p>
              <div className="flex flex-1 flex-col gap-2">
                {doDia.length === 0 ? (
                  <p className="pt-1.5 text-xs text-muted-foreground">Indisponível.</p>
                ) : (
                  doDia.map((f) => (
                    <div key={f.id} className="flex items-center gap-3">
                      <Input
                        type="time" defaultValue={f.hora_inicio.slice(0, 5)} className="h-8 w-28"
                        onChange={(e) => atualizar.mutate({ id: f.id, hora_inicio: e.target.value })}
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="time" defaultValue={f.hora_fim.slice(0, 5)} className="h-8 w-28"
                        onChange={(e) => atualizar.mutate({ id: f.id, hora_fim: e.target.value })}
                      />
                      <Switch
                        checked={f.ativo}
                        onCheckedChange={(v) => atualizar.mutate({ id: f.id, ativo: v })}
                      />
                      <Button
                        variant="ghost" size="sm" className="text-destructive"
                        onClick={() => remover.mutate(f.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <Button
                variant="outline" size="sm" className="shrink-0"
                disabled={criar.isPending}
                onClick={() => criar.mutate({ dia_semana: dia, ...faixaPadrao(doDia) })}
                aria-label={`Adicionar faixa em ${nome}`}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Links
// ============================================================

type FormLink = {
  titulo: string; descricao: string; duracao_min: string; intervalo_min: string;
  antecedencia_min_horas: string; antecedencia_max_dias: string; teto_por_dia: string;
  permite_cancelar: boolean; permite_remarcar: boolean;
  cancelamento_min_horas: string; max_remarcacoes: string;
};

const FORM_VAZIO: FormLink = {
  titulo: "", descricao: "", duracao_min: "60", intervalo_min: "0",
  antecedencia_min_horas: "0", antecedencia_max_dias: "60", teto_por_dia: "",
  permite_cancelar: false, permite_remarcar: false,
  cancelamento_min_horas: "24", max_remarcacoes: "2",
};

function AbaLinks() {
  const qc = useQueryClient();
  const listaFn = useServerFn(listarLinks);
  const criarFn = useServerFn(criarLink);
  const atualizarFn = useServerFn(atualizarLink);
  const removerFn = useServerFn(removerLink);

  const { data, isLoading } = useQuery({ queryKey: ["mentoria-links"], queryFn: () => listaFn() });
  const links = data?.links ?? [];

  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormLink>(FORM_VAZIO);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["mentoria-links"] });

  function abrirNovo() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setAberto(true);
  }

  function abrirEdicao(l: (typeof links)[number]) {
    setEditandoId(l.id);
    setForm({
      titulo: l.titulo,
      descricao: l.descricao ?? "",
      duracao_min: String(l.duracao_min),
      intervalo_min: String(l.intervalo_min),
      antecedencia_min_horas: String(l.antecedencia_min_horas),
      antecedencia_max_dias: String(l.antecedencia_max_dias),
      teto_por_dia: l.teto_por_dia != null ? String(l.teto_por_dia) : "",
      permite_cancelar: l.permite_cancelar,
      permite_remarcar: l.permite_remarcar,
      cancelamento_min_horas: String(l.cancelamento_min_horas),
      max_remarcacoes: String(l.max_remarcacoes),
    });
    setAberto(true);
  }

  const salvar = useMutation({
    mutationFn: () => {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || undefined,
        duracao_min: Number(form.duracao_min),
        intervalo_min: Number(form.intervalo_min),
        antecedencia_min_horas: Number(form.antecedencia_min_horas),
        antecedencia_max_dias: Number(form.antecedencia_max_dias),
        teto_por_dia: form.teto_por_dia.trim() ? Number(form.teto_por_dia) : null,
        permite_cancelar: form.permite_cancelar,
        permite_remarcar: form.permite_remarcar,
        cancelamento_min_horas: Number(form.cancelamento_min_horas),
        max_remarcacoes: Number(form.max_remarcacoes),
      };
      return editandoId
        ? atualizarFn({ data: { id: editandoId, ...payload } }).then(() => undefined)
        : criarFn({ data: payload }).then(() => undefined);
    },
    onSuccess: () => {
      toast.success(editandoId ? "Link atualizado." : "Link criado.");
      setAberto(false);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarAtivo = useMutation({
    mutationFn: (args: { id: string; ativo: boolean }) => atualizarFn({ data: args }),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: (id: string) => removerFn({ data: { id } }),
    onSuccess: () => { toast.success("Link removido."); invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function copiar(slug: string) {
    const url = `${window.location.origin}/agendar/${slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Endereço copiado."),
      () => toast.error("Não consegui copiar. Copie manualmente: " + url),
    );
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={abrirNovo}><Plus className="size-4" /> Criar link</Button>
      </div>

      {links.length === 0 && (
        <div className="rounded-xl bg-muted/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum link ainda. Crie um para o aluno marcar sozinho, sem precisar de login.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.id} className="rounded-xl border border-black/5 bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <LinkIcon className="size-3.5 text-muted-foreground" /> {l.titulo}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" /> {l.duracao_min} min · intervalo de {l.intervalo_min} min
                  {l.teto_por_dia != null && <> · até {l.teto_por_dia}/dia</>}
                </p>
                <button
                  onClick={() => copiar(l.slug)}
                  className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Copy className="size-3" /> /agendar/{l.slug}
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={l.ativo}
                  onCheckedChange={(v) => alternarAtivo.mutate({ id: l.id, ativo: v })}
                />
                <Button variant="ghost" size="sm" onClick={() => abrirEdicao(l)}>Editar</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="size-3.5" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover "{l.titulo}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O endereço /agendar/{l.slug} para de funcionar. Sessões já marcadas por ele não são
                        apagadas — só perdem o vínculo com o link.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remover.mutate(l.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar link" : "Criar link"}</DialogTitle>
            <DialogDescription>
              {editandoId
                ? "O endereço não muda ao editar — quem já tem o link continua usando o mesmo."
                : "O endereço é gerado a partir do título."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className="mt-1.5" placeholder="Ex.: Mentoria de carreira"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="mt-1.5" rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duração (min)</Label>
                <Input
                  type="number" min={5} max={480} value={form.duracao_min}
                  onChange={(e) => setForm({ ...form, duracao_min: e.target.value })} className="mt-1.5"
                />
              </div>
              <div>
                <Label>Intervalo depois (min)</Label>
                <Input
                  type="number" min={0} max={480} value={form.intervalo_min}
                  onChange={(e) => setForm({ ...form, intervalo_min: e.target.value })} className="mt-1.5"
                />
              </div>
              <div>
                <Label>Antecedência mínima (horas)</Label>
                <Input
                  type="number" min={0} value={form.antecedencia_min_horas}
                  onChange={(e) => setForm({ ...form, antecedencia_min_horas: e.target.value })} className="mt-1.5"
                />
              </div>
              <div>
                <Label>Antecedência máxima (dias)</Label>
                <Input
                  type="number" min={1} max={365} value={form.antecedencia_max_dias}
                  onChange={(e) => setForm({ ...form, antecedencia_max_dias: e.target.value })} className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label>Máximo de agendamentos por dia (opcional)</Label>
              <Input
                type="number" min={1} max={50} value={form.teto_por_dia} placeholder="Sem limite"
                onChange={(e) => setForm({ ...form, teto_por_dia: e.target.value })} className="mt-1.5"
              />
            </div>

            <div className="space-y-3 rounded-lg border border-black/10 p-3">
              <p className="text-xs font-medium text-muted-foreground">O que o aluno pode fazer depois</p>

              <div className="flex items-center justify-between">
                <Label htmlFor="link-permite-cancelar" className="font-normal">Permitir cancelar</Label>
                <Switch
                  id="link-permite-cancelar"
                  checked={form.permite_cancelar}
                  onCheckedChange={(v) => setForm({ ...form, permite_cancelar: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="link-permite-remarcar" className="font-normal">Permitir remarcar</Label>
                <Switch
                  id="link-permite-remarcar"
                  checked={form.permite_remarcar}
                  onCheckedChange={(v) => setForm({ ...form, permite_remarcar: v })}
                />
              </div>

              {/* Prazo é UM campo só, usado por cancelar E remarcar — não duplicar
                  quando as duas chaves estiverem ligadas ao mesmo tempo. */}
              {(form.permite_cancelar || form.permite_remarcar) && (
                <div className={form.permite_remarcar ? "grid grid-cols-2 gap-3 pl-1" : "pl-1"}>
                  <div>
                    <Label>Até quantas horas antes</Label>
                    <Input
                      type="number" min={0} value={form.cancelamento_min_horas}
                      onChange={(e) => setForm({ ...form, cancelamento_min_horas: e.target.value })} className="mt-1.5"
                    />
                  </div>
                  {form.permite_remarcar && (
                    <div>
                      <Label>Quantas remarcações no máximo</Label>
                      <Input
                        type="number" min={0} max={50} value={form.max_remarcacoes}
                        onChange={(e) => setForm({ ...form, max_remarcacoes: e.target.value })} className="mt-1.5"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending || !form.titulo.trim() || !form.duracao_min}
            >
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
