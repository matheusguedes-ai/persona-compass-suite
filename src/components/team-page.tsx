/**
 * Tela de equipe, usada pelos menus Mentores e Colaboradores.
 *
 * São o mesmo cadastro por baixo (`team_members`); o que muda é o recorte de
 * acesso: mentor recebe grupos, colaborador recebe permissões de funcionalidade.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember,
  resetInviteToken, setMemberGroups, PERMISSOES, PERMISSAO_LABEL, type Permissao,
} from "@/lib/team.functions";
import { listGroups } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link2, Plus, RefreshCw, Search, Settings2, Trash2, UserPlus } from "lucide-react";
import { Avatar } from "@/components/avatar-upload";
import { toast } from "sonner";

type MemberGroup = { group_id: string; can_download_reports: boolean; can_schedule_mentorias: boolean; groups: { id: string; name: string } | null };
type Member = {
  id: string; name: string; email: string; kind: string; status: string;
  invite_token: string; invite_expires_at: string | null; permissions: string[];
  avatar_url?: string | null;
  team_member_groups: MemberGroup[];
};

const STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  convidado: { texto: "Convite pendente", classe: "bg-amber-50 text-amber-800 ring-amber-200" },
  ativo: { texto: "Ativo", classe: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  inativo: { texto: "Desativado", classe: "bg-muted text-muted-foreground ring-black/10" },
};

export function TeamPage({ kind }: { kind: "mentor" | "colaborador" }) {
  const ehMentor = kind === "mentor";
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [acessoDe, setAcessoDe] = useState<Member | null>(null);

  const listFn = useServerFn(listTeamMembers);
  const createFn = useServerFn(createTeamMember);
  const updateFn = useServerFn(updateTeamMember);
  const deleteFn = useServerFn(deleteTeamMember);
  const resetFn = useServerFn(resetInviteToken);

  const { data: membros = [], isLoading } = useQuery({
    queryKey: ["team", kind],
    queryFn: () => listFn({ data: { kind } }),
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["team", kind] });

  const create = useMutation({
    mutationFn: (v: { name: string; email: string; permissions: Permissao[] }) =>
      createFn({ data: { ...v, kind } }),
    onSuccess: () => { inv(); setNovoAberto(false); toast.success(ehMentor ? "Mentor convidado" : "Colaborador convidado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status?: "ativo" | "inativo"; permissions?: Permissao[] }) => updateFn({ data: v }),
    onSuccess: () => { inv(); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { inv(); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: (id: string) => resetFn({ data: { id } }),
    onSuccess: () => { inv(); toast.success("Novo link gerado — o link antigo parou de valer"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const rows = membros as Member[];
    if (!q) return rows;
    return rows.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [membros, busca]);

  const copiarConvite = (m: Member) => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${base}/convite-equipe/${m.invite_token}`);
    toast.success("Link do convite copiado");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{ehMentor ? "Mentores" : "Colaboradores"}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {ehMentor
              ? "Convide mentores e escolha a quais grupos cada um tem acesso. Fora dos grupos atribuídos, o mentor não enxerga nada da sua conta."
              : "Convide pessoas da sua equipe e marque o que cada uma pode fazer na plataforma."}
          </p>
        </div>
        <Button onClick={() => setNovoAberto(true)}>
          <Plus className="size-4" /> {ehMentor ? "Convidar mentor" : "Convidar colaborador"}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou email" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
          <UserPlus className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-base font-medium">
            {isLoading ? "Carregando…" : ehMentor ? "Nenhum mentor ainda" : "Nenhum colaborador ainda"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {ehMentor
              ? "Ao convidar, você gera um link. A pessoa entra com o email convidado e passa a ver só os grupos que você marcar."
              : "Ao convidar, você gera um link. A pessoa entra com o email convidado e passa a ter as permissões que você marcar."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-muted/50">
              <tr>
                <th className="px-6 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Situação</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">{ehMentor ? "Grupos" : "Pode fazer"}</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {lista.map((m) => {
                const st = STATUS_LABEL[m.status] ?? STATUS_LABEL.convidado;
                return (
                  <tr key={m.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar url={m.avatar_url} nome={m.name} size={32} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{m.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${st.classe}`}>
                        {st.texto}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {ehMentor ? <ResumoGrupos m={m} /> : <ResumoPermissoes m={m} />}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        {m.status !== "ativo" && (
                          <Button variant="ghost" size="sm" onClick={() => copiarConvite(m)} title="Copiar o link para a pessoa entrar">
                            <Link2 className="size-3" /> Convite
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setAcessoDe(m)}>
                          <Settings2 className="size-3" /> Acesso
                        </Button>
                        {m.status === "ativo" ? (
                          <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: m.id, status: "inativo" })}>
                            Desativar
                          </Button>
                        ) : m.status === "inativo" ? (
                          <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: m.id, status: "ativo" })}>
                            Reativar
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => reset.mutate(m.id)} title="Invalida o link antigo e gera outro">
                            <RefreshCw className="size-3" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="size-3" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover {m.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A pessoa perde o acesso à sua conta imediatamente. Os dados dela (grupos, avaliados,
                                respostas) continuam na sua conta — só o acesso é removido.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove.mutate(m.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NovoDialog
        aberto={novoAberto} setAberto={setNovoAberto} ehMentor={ehMentor}
        salvando={create.isPending}
        onSalvar={(v) => create.mutate(v)}
      />
      {acessoDe && (
        <AcessoDialog
          membro={acessoDe} ehMentor={ehMentor} onFechar={() => setAcessoDe(null)}
          onSalvarPermissoes={(perms) => { update.mutate({ id: acessoDe.id, permissions: perms }); setAcessoDe(null); }}
        />
      )}
    </div>
  );
}

function ResumoGrupos({ m }: { m: Member }) {
  const gs = m.team_member_groups ?? [];
  if (gs.length === 0) return <span className="text-amber-700">Nenhum grupo — não vê nada ainda</span>;
  const baixam = gs.filter((g) => g.can_download_reports).length;
  return (
    <span>
      {gs.map((g) => g.groups?.name).filter(Boolean).join(", ")}
      <span className="ml-1 opacity-70">
        · {baixam === 0 ? "só visualiza" : baixam === gs.length ? "pode baixar" : `baixa em ${baixam}`}
      </span>
    </span>
  );
}

function ResumoPermissoes({ m }: { m: Member }) {
  const ps = (m.permissions ?? []) as Permissao[];
  if (ps.length === 0) return <span className="text-amber-700">Nenhuma permissão marcada</span>;
  return <span>{ps.map((p) => PERMISSAO_LABEL[p]?.titulo ?? p).join(", ")}</span>;
}

function NovoDialog({
  aberto, setAberto, ehMentor, salvando, onSalvar,
}: {
  aberto: boolean; setAberto: (v: boolean) => void; ehMentor: boolean; salvando: boolean;
  onSalvar: (v: { name: string; email: string; permissions: Permissao[] }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState<Permissao[]>([]);

  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) { setName(""); setEmail(""); setPerms([]); } }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ehMentor ? "Convidar mentor" : "Convidar colaborador"}</DialogTitle>
          <DialogDescription>
            O convite vale só para o email informado — quem receber o link e entrar com outro email é recusado.
            {ehMentor && " Depois de criar, use “Acesso” para escolher os grupos."}
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-novo-membro"
          onSubmit={(e) => { e.preventDefault(); onSalvar({ name: name.trim(), email: email.trim(), permissions: perms }); }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={160} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} />
          </div>
          {!ehMentor && (
            <div className="space-y-2">
              <Label>O que pode fazer</Label>
              <div className="space-y-2">
                {PERMISSOES.map((p) => (
                  <label key={p} className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/5 p-2.5 hover:bg-muted/40">
                    <Checkbox
                      checked={perms.includes(p)}
                      onCheckedChange={() => setPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
                    />
                    <div>
                      <p className="text-sm font-medium">{PERMISSAO_LABEL[p].titulo}</p>
                      <p className="text-xs text-muted-foreground">{PERMISSAO_LABEL[p].ajuda}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button type="submit" form="form-novo-membro" disabled={salvando}>
            {salvando ? "Criando…" : "Criar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AcessoDialog({
  membro, ehMentor, onFechar, onSalvarPermissoes,
}: {
  membro: Member; ehMentor: boolean; onFechar: () => void;
  onSalvarPermissoes: (p: Permissao[]) => void;
}) {
  const qc = useQueryClient();
  const listGroupsFn = useServerFn(listGroups);
  const setGroupsFn = useServerFn(setMemberGroups);
  const { data: grupos = [] } = useQuery({ queryKey: ["groups"], queryFn: () => listGroupsFn(), enabled: ehMentor });

  // Duas permissões por grupo: baixar relatório e agendar mentoria. São
  // independentes de propósito — um mentor pode conduzir a conversa sem levar
  // o relatório embora, e o contrário também acontece.
  type PermsDoGrupo = { baixar: boolean; agendar: boolean };
  const [sel, setSel] = useState<Record<string, PermsDoGrupo>>(() =>
    Object.fromEntries((membro.team_member_groups ?? []).map((g) => [
      g.group_id,
      { baixar: g.can_download_reports, agendar: g.can_schedule_mentorias ?? false },
    ])),
  );
  const [perms, setPerms] = useState<Permissao[]>((membro.permissions ?? []) as Permissao[]);

  const salvarGrupos = useMutation({
    mutationFn: () =>
      setGroupsFn({
        data: {
          member_id: membro.id,
          groups: Object.entries(sel).map(([group_id, p]) => ({
            group_id,
            can_download_reports: p.baixar,
            can_schedule_mentorias: p.agendar,
          })),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", "mentor"] });
      toast.success("Acesso atualizado");
      onFechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcado = (id: string) => Object.prototype.hasOwnProperty.call(sel, id);
  const alternar = (id: string) =>
    setSel((prev) => {
      const next = { ...prev };
      if (Object.prototype.hasOwnProperty.call(next, id)) delete next[id];
      else next[id] = { baixar: false, agendar: false };
      return next;
    });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Acesso de {membro.name}</DialogTitle>
          <DialogDescription>
            {ehMentor
              ? "Marque os grupos que este mentor pode acompanhar. Ele só enxerga os avaliados e os relatórios desses grupos."
              : "Marque o que esta pessoa pode fazer na plataforma."}
          </DialogDescription>
        </DialogHeader>

        {ehMentor ? (
          <div className="space-y-2">
            {grupos.length === 0 && (
              <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                Você ainda não tem grupos. Crie um grupo primeiro para poder dar acesso.
              </p>
            )}
            {(grupos as Array<{ id: string; name: string; people_count?: number }>).map((g) => (
              <div key={g.id} className="rounded-lg border border-black/5 p-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox checked={marcado(g.id)} onCheckedChange={() => alternar(g.id)} />
                  <span className="text-sm font-medium">{g.name}</span>
                  {g.people_count != null && (
                    <span className="text-xs text-muted-foreground">{g.people_count} pessoa(s)</span>
                  )}
                </label>
                {marcado(g.id) && (
                  <div className="mt-3 space-y-3 border-t border-black/5 pt-3 pl-7">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium">Pode baixar os relatórios</p>
                        <p className="text-[11px] text-muted-foreground">
                          Desligado, ele lê o relatório na tela mas não consegue salvar em PDF.
                        </p>
                      </div>
                      <Switch
                        checked={sel[g.id]?.baixar ?? false}
                        onCheckedChange={(v) =>
                          setSel((prev) => ({ ...prev, [g.id]: { ...prev[g.id], baixar: v } }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium">Pode agendar mentorias</p>
                        <p className="text-[11px] text-muted-foreground">
                          Desligado, ele acompanha a fila mas não marca nem registra a conversa.
                        </p>
                      </div>
                      <Switch
                        checked={sel[g.id]?.agendar ?? false}
                        onCheckedChange={(v) =>
                          setSel((prev) => ({ ...prev, [g.id]: { ...prev[g.id], agendar: v } }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {PERMISSOES.map((p) => (
              <label key={p} className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/5 p-2.5 hover:bg-muted/40">
                <Checkbox
                  checked={perms.includes(p)}
                  onCheckedChange={() => setPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
                />
                <div>
                  <p className="text-sm font-medium">{PERMISSAO_LABEL[p].titulo}</p>
                  <p className="text-xs text-muted-foreground">{PERMISSAO_LABEL[p].ajuda}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          {ehMentor ? (
            <Button onClick={() => salvarGrupos.mutate()} disabled={salvarGrupos.isPending}>
              {salvarGrupos.isPending ? "Salvando…" : "Salvar acesso"}
            </Button>
          ) : (
            <Button onClick={() => onSalvarPermissoes(perms)}>Salvar permissões</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
