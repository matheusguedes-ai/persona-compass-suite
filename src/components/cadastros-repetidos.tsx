/**
 * #300 (entrega 2) — aviso de cadastros repetidos na tela de Pessoas, e a
 * revisão par a par: escolher quem fica, ver a prévia, unificar (ou marcar
 * que não são a mesma pessoa). Some sozinho quando não há par nenhum ou
 * quando quem está vendo não tem permissão de Pessoas.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, KeyRound, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { mensagemDeErro } from "@/lib/erro-legivel";
import {
  listarCadastrosRepetidos, naoSaoAMesmaPessoa, previaDaUnificacao, unificarCadastros,
  type ParRepetido, type PessoaResumo, type PreviaFusao,
} from "@/lib/duplicados.functions";

const MOTIVO: Record<ParRepetido["motivo"], string> = {
  telefone: "Mesmo telefone",
  nome: "Nome parecido",
  telefone_e_nome: "Mesmo telefone e nome parecido",
};

const TABELA: Record<string, [string, string]> = {
  assessment_responses: ["bateria", "baterias"],
  group_members: ["grupo", "grupos"],
  treinamento_presencas: ["presença em aula", "presenças em aula"],
  treinamento_aula_conclusoes: ["aula concluída", "aulas concluídas"],
  treinamento_avaliacoes: ["avaliação de aula", "avaliações de aula"],
  certificados: ["certificado", "certificados"],
  mentorias: ["mentoria", "mentorias"],
  email_logs: ["registro de e-mail enviado", "registros de e-mail enviados"],
  team_members: ["vínculo com a equipe", "vínculos com a equipe"],
  destinos: ["liberação individual", "liberações individuais"],
};

const CAMPO: Record<string, string> = {
  phone: "telefone", profession: "profissão", role_at_company: "cargo", company_name: "empresa",
  avatar_url: "foto", banner_url: "capa do perfil", linkedin_url: "LinkedIn", instagram_url: "Instagram",
  site_url: "site", notes: "observações",
};

function contagem(n: number, [um, varios]: [string, string]) {
  return `${n} ${n === 1 ? um : varios}`;
}

export function CadastrosRepetidos() {
  const listarFn = useServerFn(listarCadastrosRepetidos);
  const { data, error } = useQuery({
    queryKey: ["cadastros-repetidos"],
    queryFn: () => listarFn(),
    retry: false,
  });
  const [aberto, setAberto] = useState(false);

  // Sem permissão de Pessoas (ou nada a mostrar): o aviso simplesmente não existe.
  if (error || !data || data.pares.length === 0) return null;
  const n = data.pares.length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/70 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="flex items-start gap-3">
          <Users2 className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">{n === 1 ? "1 possível cadastro repetido" : `${n} possíveis cadastros repetidos`}</p>
            <p className="text-sm text-muted-foreground">
              Pessoas com o mesmo telefone ou nome muito parecido. Unifique para que as respostas fiquem num cadastro só.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setAberto(true)}>Revisar</Button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastros repetidos</DialogTitle>
            <DialogDescription>
              Para cada par, escolha o cadastro que fica. Tudo do outro — respostas, grupos, presenças — passa
              para ele, e um registro completo do que existia fica guardado. Nada acontece sem você confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {data.pares.map((par) => (
              <ParCard key={`${par.a.id}-${par.b.id}`} par={par} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PessoaCard({ p, fica, onEscolher }: { p: PessoaResumo; fica: boolean; onEscolher: () => void }) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      className={`w-full rounded-lg p-3 text-left ring-1 transition ${
        fica ? "bg-emerald-50 ring-2 ring-emerald-500 dark:bg-emerald-500/10" : "bg-card ring-black/10 hover:bg-muted/50 dark:ring-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{p.full_name}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
          fica ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
        }`}>
          {fica ? "Fica" : "Some"}
        </span>
      </div>
      <p className="mt-1 break-all text-xs text-muted-foreground">{p.email}</p>
      <p className="text-xs text-muted-foreground">{p.phone ?? "sem telefone"}</p>
      <ul className="mt-2 space-y-0.5 text-xs">
        <li className="flex items-center gap-1.5">
          <KeyRound className="size-3 text-muted-foreground" /> {p.tem_login ? "Tem login" : "Sem login"}
        </li>
        <li>
          {p.respostas === 1 ? "1 resposta" : `${p.respostas} respostas`}
          {p.respostas > 0 && ` (${p.respostas_entregues} entregue${p.respostas_entregues === 1 ? "" : "s"})`}
        </li>
        <li>{p.grupos.length > 0 ? `Grupos: ${p.grupos.join(", ")}` : "Sem grupo"}</li>
        <li className="text-muted-foreground">Cadastrado em {new Date(p.created_at).toLocaleDateString("pt-BR")}</li>
      </ul>
    </button>
  );
}

function ParCard({ par }: { par: ParRepetido }) {
  const qc = useQueryClient();
  const previaFn = useServerFn(previaDaUnificacao);
  const unificarFn = useServerFn(unificarCadastros);
  const naoSaoFn = useServerFn(naoSaoAMesmaPessoa);

  const [manter, setManter] = useState(par.sugestao_manter);
  const [previa, setPrevia] = useState<PreviaFusao | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const fica = manter === par.a.id ? par.a : par.b;
  const some = manter === par.a.id ? par.b : par.a;

  const escolher = (id: string) => {
    setManter(id);
    setPrevia(null);
  };

  const verPrevia = useMutation({
    mutationFn: () => previaFn({ data: { manter: fica.id, absorver: some.id } }),
    onSuccess: setPrevia,
    onError: (e) => toast.error(mensagemDeErro(e, undefined, "Não consegui montar a prévia.")),
  });

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["cadastros-repetidos"] });
    qc.invalidateQueries({ queryKey: ["people"] });
  };

  const unificar = useMutation({
    mutationFn: () => unificarFn({ data: { manter: fica.id, absorver: some.id } }),
    onSuccess: () => {
      toast.success(`Cadastros unificados. Tudo foi para o cadastro de ${fica.full_name}.`);
      atualizar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, undefined, "Não foi possível unificar.")),
  });

  const naoSao = useMutation({
    mutationFn: () => naoSaoFn({ data: { pessoa_a: par.a.id, pessoa_b: par.b.id } }),
    onSuccess: () => {
      toast.success("Certo — esse par não aparece mais.");
      atualizar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, undefined, "Não foi possível registrar.")),
  });

  const movidos = previa?.mover
    ? Object.entries(previa.mover).filter(([k, v]) => v > 0 && k !== "test_responses_entregues")
    : [];
  const conflitos = previa?.conflitos ? Object.entries(previa.conflitos).filter(([, v]) => v > 0) : [];
  const campos = previa?.campos ? Object.keys(previa.campos) : [];
  const bloqueado = (previa?.bloqueios.length ?? 0) > 0;

  return (
    <div className="rounded-xl bg-muted/30 p-4 ring-1 ring-black/5 dark:ring-white/10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
          {MOTIVO[par.motivo]}
        </span>
        {par.disse_que_era_nova && (
          <span className="text-xs text-muted-foreground">
            No link aberto, essa pessoa disse que era um cadastro novo.
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">Toque no cadastro que deve ficar:</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <PessoaCard p={par.a} fica={manter === par.a.id} onEscolher={() => escolher(par.a.id)} />
        <PessoaCard p={par.b} fica={manter === par.b.id} onEscolher={() => escolher(par.b.id)} />
      </div>

      {previa && (
        <div className="mt-4 space-y-2 rounded-lg bg-card p-3 text-sm ring-1 ring-black/5 dark:ring-white/10">
          {bloqueado ? (
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{previa.bloqueios[0]}</p>
            </div>
          ) : (
            <>
              <p className="font-medium">O que vai acontecer</p>
              <p>
                O cadastro de <strong>{some.full_name}</strong> ({some.email}) deixa de existir.{" "}
                {movidos.length === 0 && (previa.mover?.test_responses ?? 0) === 0
                  ? "Ele não tem nada amarrado."
                  : "Vai para o cadastro que fica:"}
              </p>
              {((previa.mover?.test_responses ?? 0) > 0 || movidos.length > 0) && (
                <ul className="list-inside list-disc text-muted-foreground">
                  {(previa.mover?.test_responses ?? 0) > 0 && (
                    <li>
                      {contagem(previa.mover!.test_responses, ["resposta de teste", "respostas de teste"])}
                      {` (${previa.mover!.test_responses_entregues ?? 0} entregue${previa.mover!.test_responses_entregues === 1 ? "" : "s"})`}
                    </li>
                  )}
                  {movidos.filter(([k]) => k !== "test_responses").map(([k, v]) => (
                    <li key={k}>{contagem(v, TABELA[k] ?? [k, k])}</li>
                  ))}
                </ul>
              )}
              {conflitos.length > 0 && (
                <p className="text-muted-foreground">
                  Já existem no cadastro que fica (a cópia repetida é descartada e guardada no registro):{" "}
                  {conflitos.map(([k, v]) => contagem(v, TABELA[k] ?? [k, k])).join(", ")}.
                </p>
              )}
              {campos.length > 0 && (
                <p className="text-muted-foreground">
                  Completa no cadastro que fica, que estava em branco: {campos.map((c) => CAMPO[c] ?? c).join(", ")}.
                </p>
              )}
              <p className="text-muted-foreground">
                {previa.login === "movido" && "O login passa para o cadastro que fica — a pessoa continua entrando do mesmo jeito."}
                {previa.login === "mantido" && "O login do cadastro que fica continua o mesmo."}
                {previa.login === "nenhum" && "Nenhum dos dois tem login ainda."}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" /> Nenhuma resposta se perde.
              </p>
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!previa ? (
          <Button size="sm" onClick={() => verPrevia.mutate()} disabled={verPrevia.isPending}>
            {verPrevia.isPending ? "Calculando…" : "Ver o que vai acontecer"}
          </Button>
        ) : (
          <Button size="sm" onClick={() => setConfirmando(true)} disabled={bloqueado || unificar.isPending}>
            {unificar.isPending ? "Unificando…" : "Unificar"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => naoSao.mutate()} disabled={naoSao.isPending || unificar.isPending}>
          Não são a mesma pessoa
        </Button>
      </div>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unificar os cadastros?</AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro de {some.full_name} ({some.email}) será apagado, e tudo dele passa para o de{" "}
              {fica.full_name}. Um registro completo do que existia fica guardado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => unificar.mutate()}>Unificar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
