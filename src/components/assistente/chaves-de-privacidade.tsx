/**
 * #316A — as quatro chaves de privacidade da assistente, na mão do aluno.
 *
 * O que a tela precisa deixar VISÍVEL (decisão do dono do produto, 28/09): as duas primeiras chaves só
 * beneficiam o aluno; as duas últimas tiram algo dele. Por isso dois blocos com um separador entre eles —
 * listar as quatro iguais seria desonesto.
 *
 * Serve a dois lugares: a tela do termo (a escolha fica local e vai junto com o aceite) e o painel
 * Privacidade (cada mudança vai para o servidor na hora). Nos dois, desligar uma chave que está ligada NO
 * BANCO abre, na mesma hora, a pergunta do dono: apagar o que foi guardado ou manter em espera. Quem
 * decide de verdade é o banco (`assistente_gravar_chaves`); aqui só não se oferece o que ele recusaria.
 */
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CHAVES, DEFINICAO_DAS_CHAVES, desligadasEntre, mexerNaChave,
  type Chave, type EscolhaAoDesligar, type EscolhasAoDesligar, type EstadoDasChaves,
} from "@/lib/assistente/chaves";
import { PRIVACIDADE } from "@/lib/assistente/textos";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Lock } from "lucide-react";

type Pendente = { chave: Chave; novo: EstadoDasChaves; desligadas: Chave[] };

export function ChavesDePrivacidade({
  salvo, valor, onMudar, ocupado = false,
}: {
  /** O que está gravado no banco. Desligar uma chave ligada AQUI pede a escolha do que fazer com o guardado. */
  salvo: EstadoDasChaves;
  /** O que a tela mostra agora. */
  valor: EstadoDasChaves;
  onMudar: (novo: EstadoDasChaves, escolhas: EscolhasAoDesligar) => void;
  ocupado?: boolean;
}) {
  const [pendente, setPendente] = useState<Pendente | null>(null);

  function mexer(chave: Chave, ligada: boolean) {
    const novo = mexerNaChave(valor, chave, ligada);
    // Pede a escolha só para o que estava ligado no banco e desliga agora: ligar e desligar de novo antes
    // de salvar não guardou nada.
    const desligadas = desligadasEntre(valor, novo).filter((c) => salvo[c]);
    if (desligadas.length) setPendente({ chave, novo, desligadas });
    else onMudar(novo, {});
  }

  function escolher(escolha: EscolhaAoDesligar) {
    if (!pendente) return;
    onMudar(pendente.novo, Object.fromEntries(pendente.desligadas.map((c) => [c, escolha])));
    setPendente(null);
  }

  const doGrupo = (g: "fica" | "sai") => CHAVES.filter((c) => DEFINICAO_DAS_CHAVES[c].grupo === g);
  const algumaEmBreve = CHAVES.some((c) => !DEFINICAO_DAS_CHAVES[c].disponivel);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{PRIVACIDADE.introChaves}</p>

      <GrupoDeChaves
        titulo={PRIVACIDADE.grupoFica}
        icone={<Lock className="size-3.5" />}
        chaves={doGrupo("fica")}
        valor={valor}
        ocupado={ocupado}
        onMexer={mexer}
      />

      <div role="separator" aria-hidden className="h-px bg-border" />

      <GrupoDeChaves
        titulo={PRIVACIDADE.grupoSai}
        nota={PRIVACIDADE.grupoSaiNota}
        icone={<ArrowUpRight className="size-3.5" />}
        chaves={doGrupo("sai")}
        valor={valor}
        ocupado={ocupado}
        onMexer={mexer}
      />

      {algumaEmBreve && <p className="text-xs leading-relaxed text-muted-foreground">{PRIVACIDADE.emBreveNota}</p>}

      <AlertDialog open={!!pendente} onOpenChange={(aberto) => { if (!aberto) setPendente(null); }}>
        {pendente && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{PRIVACIDADE.desligarTitulo(DEFINICAO_DAS_CHAVES[pendente.chave].titulo)}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {pendente.chave === "lembrar_conversas" && pendente.desligadas.includes("mentor_acompanha") && (
                    <p>{PRIVACIDADE.desligarJunto}</p>
                  )}
                  <p className="font-medium text-foreground">{PRIVACIDADE.desligarPergunta}</p>
                  {pendente.desligadas.every((c) => !DEFINICAO_DAS_CHAVES[c].disponivel) && (
                    <p>{PRIVACIDADE.desligarNadaGuardado}</p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            {/* As duas escolhas lado a lado, com o mesmo peso: nenhuma é a "certa". */}
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel className="sm:mr-auto">{PRIVACIDADE.continuarLigada}</AlertDialogCancel>
              {/* A ação do diálogo nasce com as cores do botão principal; "outline" troca o fundo mas não a
                  cor do texto — sem a cor explícita, o texto claro do botão principal ficava sobre o fundo
                  do cartão (ilegível no escuro, #318). */}
              <AlertDialogAction
                className={cn(buttonVariants({ variant: "outline" }), "text-foreground hover:text-foreground")}
                onClick={() => escolher("manter")}
              >
                {PRIVACIDADE.manterEmEspera}
              </AlertDialogAction>
              <AlertDialogAction
                className={cn(buttonVariants({ variant: "outline" }), "text-destructive hover:text-destructive")}
                onClick={() => escolher("apagar")}
              >
                {PRIVACIDADE.apagarGuardado}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}

function GrupoDeChaves({
  titulo, nota, icone, chaves, valor, ocupado, onMexer,
}: {
  titulo: string;
  nota?: string;
  icone: React.ReactNode;
  chaves: Chave[];
  valor: EstadoDasChaves;
  ocupado: boolean;
  onMexer: (chave: Chave, ligada: boolean) => void;
}) {
  return (
    <section className="rounded-lg border border-input p-3 sm:p-4">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icone} {titulo}
      </h4>
      {nota && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{nota}</p>}
      <div className="mt-2 divide-y divide-border">
        {chaves.map((c) => {
          const def = DEFINICAO_DAS_CHAVES[c];
          // A 3 só liga com a 1: com a 1 desligada, ela fica travada (e desligada).
          const travada = c === "mentor_acompanha" && !valor.lembrar_conversas;
          return (
            <div key={c} className="flex items-start gap-3 py-3 first:pt-2 last:pb-1">
              <Switch
                id={`chave-${c}`}
                checked={valor[c]}
                disabled={ocupado || travada}
                onCheckedChange={(ligada) => onMexer(c, ligada)}
                aria-describedby={`chave-${c}-descricao`}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`chave-${c}`}
                  className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", travada ? "cursor-not-allowed" : "cursor-pointer")}
                >
                  {def.titulo}
                  {!def.disponivel && (
                    <span className="rounded-full border border-input px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                      {PRIVACIDADE.emBreve}
                    </span>
                  )}
                </label>
                <p id={`chave-${c}-descricao`} className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {def.descricao}
                  {travada && <span className="mt-1 block">{PRIVACIDADE.precisaDaMemoria}</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
