/**
 * #313 — Quem vê o quê na Biblioteca, do lado da tela. NADA aqui calcula acesso: o selo, a lista
 * "quem vê isto" e o motivo de cada pessoa vêm prontos do banco (`bib_resumo_acesso`, `bib_quem_ve`,
 * ambos pela função única `bib_decide`). A tela só desenha — se desenhasse por conta própria, poderia
 * discordar do que o aluno realmente vê, que é exatamente o erro que esta demanda proíbe.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Ban, Eye, EyeOff, Loader2, Lock, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erro-legivel";
import { meusGrupos } from "@/lib/comunidade.functions";
import { listarPessoasParaEscolher } from "@/lib/data.functions";
import {
  lerRegrasDaBiblioteca, quemVeNaBiblioteca, salvarMenuDaBiblioteca, salvarRegrasDaBiblioteca,
  type AcessoResumido,
} from "@/lib/biblioteca.functions";

export type Alvo = "pasta" | "material";

/** O selo de cada pasta/material. "Não liberado para ninguém" é o banco dizendo 0 — nunca um palpite. */
export function SeloDeAcesso({ acesso, onClick, className }: { acesso: AcessoResumido; onClick?: () => void; className?: string }) {
  const ninguem = acesso.veem === 0;
  const bloqueadas = `${acesso.bloqueados} bloqueada${acesso.bloqueados === 1 ? "" : "s"}`;
  // "Ninguém vê" por bloqueio é diferente de "nunca foi liberado": o selo diz qual dos dois.
  const texto = ninguem
    ? acesso.bloqueados ? `Ninguém vê · ${bloqueadas}` : "Não liberado para ninguém"
    : `${acesso.veem} ${acesso.veem === 1 ? "pessoa vê" : "pessoas veem"}${
        acesso.veemComLogin === 0 ? " (nenhuma com login ainda)" : ""
      }${acesso.bloqueados ? ` · ${bloqueadas}` : ""}`;
  const Icone = ninguem ? Lock : Eye;
  const corpo = (
    <>
      <Icone className="size-3.5 shrink-0" />
      <span className="truncate">{texto}</span>
    </>
  );
  const estilo = cn(
    "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
    ninguem ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
    // Clicável no celular: 32 px de altura + 4 px de folga invisível em volta = 40 px de toque.
    onClick && "relative min-h-8 cursor-pointer hover:opacity-80 after:absolute after:-inset-1 after:content-['']",
    className,
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={estilo} title="Quem vê isto">{corpo}</button>
  ) : (
    <span className={estilo}>{corpo}</span>
  );
}

const COMO: Record<string, string> = {
  menu: "Pelo menu Biblioteca (herança)",
  heranca: "Herdado de uma pasta liberada",
  direto: "Liberação direta aqui",
};

/** "Quem vê isto": a lista final, já resolvida pelo banco, pessoa a pessoa, com o motivo. */
export function DialogoQuemVe({
  aberto, onFechar, alvo, id, titulo,
}: { aberto: boolean; onFechar: () => void; alvo: Alvo; id: string | null; titulo: string }) {
  const fn = useServerFn(quemVeNaBiblioteca);
  const { data, isLoading, error } = useQuery({
    queryKey: ["biblioteca-quem-ve", alvo, id],
    queryFn: () => fn({ data: { alvo, id: id! } }),
    enabled: aberto && !!id,
  });
  const pessoas = data?.pessoas ?? [];
  const veem = pessoas.filter((p) => p.resultado === "ve");
  const bloqueados = pessoas.filter((p) => p.resultado === "bloqueado");
  const semAcesso = pessoas.filter((p) => p.resultado === "sem_acesso");
  const porComo = (["menu", "heranca", "direto"] as const)
    .map((c) => [c, veem.filter((p) => p.como === c)] as const)
    .filter(([, lista]) => lista.length > 0);

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quem vê isto</DialogTitle>
          <DialogDescription>
            {alvo === "pasta" ? "Pasta" : "Material"} "{titulo}". Esta é a lista final, com as liberações,
            os bloqueios e a herança já resolvidos — a mesma conta que decide o que cada aluno vê.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Calculando…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{mensagemDeErro(error)}</p>
        ) : (
          <div className="space-y-4 text-sm">
            <p className={cn("rounded-lg px-3 py-2 text-xs font-medium", veem.length ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100" : "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100")}>
              {veem.length
                ? `${veem.length} ${veem.length === 1 ? "pessoa vê" : "pessoas veem"} (${veem.filter((p) => p.tem_login).length} com login)`
                : bloqueados.length ? "Ninguém vê" : "Ninguém vê — não liberado para ninguém."}
              {bloqueados.length ? ` · ${bloqueados.length} bloqueada${bloqueados.length === 1 ? "" : "s"}` : ""}
            </p>
            {porComo.map(([como, lista]) => (
              <section key={como}>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Eye className="size-3.5" /> {COMO[como]} — {lista.length}</h3>
                <ListaDePessoas pessoas={lista} />
              </section>
            ))}
            {bloqueados.length > 0 && (
              <section>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-destructive"><Ban className="size-3.5" /> Bloqueadas — não veem, mesmo com liberação — {bloqueados.length}</h3>
                <ListaDePessoas pessoas={bloqueados} />
              </section>
            )}
            {semAcesso.length > 0 && (
              <details className="rounded-lg border border-black/5 px-3 py-2 dark:border-white/10">
                <summary className="flex min-h-9 cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <EyeOff className="size-3.5" /> Não veem (sem menu e sem liberação) — {semAcesso.length}
                </summary>
                <div className="mt-2"><ListaDePessoas pessoas={semAcesso} semMotivo /></div>
              </details>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ListaDePessoas({
  pessoas, semMotivo = false,
}: {
  pessoas: Array<{ person_id: string; nome: string; tem_login: boolean; equipe: boolean; grupos: string[]; motivo: string }>;
  semMotivo?: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {pessoas.map((p) => (
        <li key={p.person_id} className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
            {p.nome}
            {!p.tem_login && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">sem login ainda</span>}
            {p.equipe && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">equipe: vê tudo pelo painel</span>}
          </p>
          {p.grupos.length > 0 && <p className="text-[11px] text-muted-foreground">{p.grupos.join(" · ")}</p>}
          {!semMotivo && <p className="text-xs text-muted-foreground">{p.motivo}</p>}
        </li>
      ))}
    </ul>
  );
}

// --------------------------------------------------------------------------- escolher grupos/pessoas
function Escolha({
  titulo, ajuda, tom, grupos, pessoas, marcadosG, marcadosP, onG, onP, busca,
}: {
  titulo: string; ajuda: string; tom: "libera" | "bloqueia";
  grupos: Array<{ id: string; name: string }>; pessoas: Array<{ id: string; full_name: string }>;
  marcadosG: string[]; marcadosP: string[]; onG: (id: string) => void; onP: (id: string) => void; busca: string;
}) {
  const termo = busca.trim().toLowerCase();
  const pessoasFiltradas = termo ? pessoas.filter((p) => p.full_name.toLowerCase().includes(termo)) : pessoas;
  return (
    <section className={cn("rounded-lg border p-3", tom === "bloqueia" ? "border-destructive/30" : "border-black/10 dark:border-white/10")}>
      <h3 className={cn("text-sm font-semibold", tom === "bloqueia" && "text-destructive")}>{titulo}</h3>
      <p className="mb-2 text-[11px] text-muted-foreground">{ajuda}</p>
      <p className="text-xs font-medium text-muted-foreground">Grupos</p>
      {grupos.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum grupo.</p> : (
        <ul className="mt-1 space-y-0.5">
          {grupos.map((g) => (
            <li key={g.id}>
              <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={marcadosG.includes(g.id)} onCheckedChange={() => onG(g.id)} /> {g.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs font-medium text-muted-foreground">Pessoas</p>
      <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
        {pessoasFiltradas.map((p) => (
          <li key={p.id}>
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={marcadosP.includes(p.id)} onCheckedChange={() => onP(p.id)} /> {p.full_name}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Liberar e bloquear num lugar só. Marcar alguém de um lado tira do outro: a mesma pessoa liberada e
 * bloqueada no mesmo item não teria efeito nenhum (o bloqueio vence) e só confundiria.
 */
export function DialogoRegras({
  aberto, onFechar, alvo, id, titulo, onSalvo,
}: { aberto: boolean; onFechar: () => void; alvo: Alvo; id: string | null; titulo: string; onSalvo: () => void }) {
  const lerFn = useServerFn(lerRegrasDaBiblioteca);
  const salvarFn = useServerFn(salvarRegrasDaBiblioteca);
  const gruposFn = useServerFn(meusGrupos);
  const pessoasFn = useServerFn(listarPessoasParaEscolher);
  const regras = useQuery({ queryKey: ["biblioteca-regras", alvo, id], queryFn: () => lerFn({ data: { alvo, id: id! } }), enabled: aberto && !!id });
  const grupos = useQuery({ queryKey: ["grupos"], queryFn: () => gruposFn(), enabled: aberto });
  const pessoas = useQuery({ queryKey: ["pessoas-destino"], queryFn: () => pessoasFn(), enabled: aberto });
  const [libG, setLibG] = useState<string[]>([]);
  const [libP, setLibP] = useState<string[]>([]);
  const [bloqG, setBloqG] = useState<string[]>([]);
  const [bloqP, setBloqP] = useState<string[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!aberto || !regras.data) return;
    setLibG(regras.data.liberados.grupos); setLibP(regras.data.liberados.pessoas);
    setBloqG(regras.data.bloqueados.grupos); setBloqP(regras.data.bloqueados.pessoas);
  }, [aberto, regras.data]);

  const alterna = (lista: string[], set: (v: string[]) => void, outra: string[], setOutra: (v: string[]) => void, x: string) => {
    if (lista.includes(x)) set(lista.filter((y) => y !== x));
    else { set([...lista, x]); if (outra.includes(x)) setOutra(outra.filter((y) => y !== x)); }
  };

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { alvo, id: id!, liberados: { grupos: libG, pessoas: libP }, bloqueados: { grupos: bloqG, pessoas: bloqP } } }),
    onSuccess: () => { toast.success("Acesso atualizado. O selo e o \"quem vê isto\" já mostram o resultado."); onSalvo(); onFechar(); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const listaG = grupos.data?.grupos ?? [];
  const listaP = pessoas.data?.pessoas ?? [];
  const oQue = alvo === "pasta" ? "esta pasta e tudo o que está dentro dela" : "este material";

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liberar ou bloquear</DialogTitle>
          <DialogDescription>
            "{titulo}" segue o acesso de onde está (o menu Biblioteca e as pastas acima). Aqui você abre
            exceções só para {oQue}.
          </DialogDescription>
        </DialogHeader>
        {regras.isLoading || grupos.isLoading || pessoas.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</p>
        ) : regras.error || grupos.error ? (
          <p className="text-sm text-destructive">{mensagemDeErro(regras.error ?? grupos.error)}</p>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-3 size-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar pessoas" className="h-10 pl-8" />
            </div>
            <Escolha titulo="Liberar também para" tom="libera"
              ajuda={`Veem ${oQue}, mesmo sem o menu Biblioteca — a não ser que estejam bloqueadas em algum lugar acima.`}
              grupos={listaG} pessoas={listaP} marcadosG={libG} marcadosP={libP} busca={busca}
              onG={(x) => alterna(libG, setLibG, bloqG, setBloqG, x)} onP={(x) => alterna(libP, setLibP, bloqP, setBloqP, x)} />
            <Escolha titulo="Bloquear para" tom="bloqueia"
              ajuda={`NÃO veem ${oQue} por caminho nenhum — tela, busca, link direto, download e assistente. O bloqueio vence qualquer liberação.`}
              grupos={listaG} pessoas={listaP} marcadosG={bloqG} marcadosP={bloqP} busca={busca}
              onG={(x) => alterna(bloqG, setBloqG, libG, setLibG, x)} onP={(x) => alterna(bloqP, setBloqP, libP, setLibP, x)} />
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !regras.data}>
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Camada 1: os grupos com o menu Biblioteca. Nasce fechado — sem grupo marcado, ninguém tem o menu. */
export function DialogoMenu({
  aberto, onFechar, atuais, onSalvo,
}: { aberto: boolean; onFechar: () => void; atuais: string[]; onSalvo: () => void }) {
  const gruposFn = useServerFn(meusGrupos);
  const salvarFn = useServerFn(salvarMenuDaBiblioteca);
  const grupos = useQuery({ queryKey: ["grupos"], queryFn: () => gruposFn(), enabled: aberto });
  const [marcados, setMarcados] = useState<string[]>([]);
  useEffect(() => { if (aberto) setMarcados(atuais); }, [aberto, atuais]);
  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { grupos: marcados } }),
    onSuccess: () => { toast.success("Menu Biblioteca atualizado."); onSalvo(); onFechar(); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });
  const lista = useMemo(() => grupos.data?.grupos ?? [], [grupos.data]);
  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quem tem o menu Biblioteca</DialogTitle>
          <DialogDescription>
            O grupo marcado vê a Biblioteca inteira — menos o que você bloquear para ele numa pasta ou
            material. Sem grupo marcado, o menu fica fechado para todos; ainda dá para liberar uma pasta ou
            um material a pessoas específicas.
          </DialogDescription>
        </DialogHeader>
        {grupos.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</p>
        ) : grupos.error ? (
          <p className="text-sm text-destructive">{mensagemDeErro(grupos.error)}</p>
        ) : (
          <ul className="space-y-0.5">
            {lista.map((g) => (
              <li key={g.id}>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={marcados.includes(g.id)}
                    onCheckedChange={() => setMarcados((m) => (m.includes(g.id) ? m.filter((x) => x !== g.id) : [...m, g.id]))} />
                  <Users className="size-4 text-muted-foreground" /> {g.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || grupos.isLoading}>
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
