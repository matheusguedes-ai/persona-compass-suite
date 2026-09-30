/**
 * "Recebimento de mensagens" — no perfil do ALUNO (#291 F1b).
 *
 * Só o próprio aluno ativa: para ligar o WhatsApp ele confirma o número com um código que chega no celular.
 * Desligar vale na hora e não pede código. Em "Ver como aluno" a tela é só leitura: o servidor também recusa.
 * O telefone aparece MASCARADO; o aluno não edita o telefone do cadastro — se estiver errado, avisa o mentor.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mensagemDeErro } from "@/lib/erro-legivel";
import { ROTULO_NIVEL, type NivelWhatsapp } from "@/lib/canal/consentimento";
import {
  avisarNumeroErrado, confirmarCodigoWhatsapp, desligarWhatsapp, getMeuWhatsapp, mudarNivelWhatsapp, pedirCodigoWhatsapp,
} from "@/lib/whatsapp-consentimento.functions";

type Escolha = NivelWhatsapp | "so_email";

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function ReceberMensagens({ previewPersonId }: { previewPersonId?: string | null }) {
  const qc = useQueryClient();
  const preview = previewPersonId ?? null;
  const lerFn = useServerFn(getMeuWhatsapp);
  const pedirFn = useServerFn(pedirCodigoWhatsapp);
  const confirmarFn = useServerFn(confirmarCodigoWhatsapp);
  const mudarFn = useServerFn(mudarNivelWhatsapp);
  const desligarFn = useServerFn(desligarWhatsapp);
  const erradoFn = useServerFn(avisarNumeroErrado);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["meu-whatsapp", preview], queryFn: () => lerFn({ data: { preview_person_id: preview } }),
  });

  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [codigoPedido, setCodigoPedido] = useState(false);
  const [codigo, setCodigo] = useState("");
  const recarregar = () => qc.invalidateQueries({ queryKey: ["meu-whatsapp"] });
  const falha = (e: Error) => toast.error(mensagemDeErro(e));

  const pedir = useMutation({
    mutationFn: (nivel: NivelWhatsapp) => pedirFn({ data: { nivel } }),
    onSuccess: () => { setCodigoPedido(true); setCodigo(""); toast.success("Enviamos um código de 6 dígitos para o seu WhatsApp."); },
    onError: falha,
  });
  const confirmar = useMutation({
    mutationFn: () => confirmarFn({ data: { codigo, aceiteTermo: true, termoVersao: data && data.temCadastro ? (data.termo.versao as "whatsapp-v1") : "whatsapp-v1" } }),
    onSuccess: () => { setCodigoPedido(false); setCodigo(""); setEscolha(null); recarregar(); toast.success("WhatsApp ativado. Você pode desligar quando quiser, nesta mesma tela."); },
    onError: falha,
  });
  const mudar = useMutation({
    mutationFn: (nivel: NivelWhatsapp) => mudarFn({ data: { nivel, aceiteTermo: true, termoVersao: "whatsapp-v1" } }),
    onSuccess: () => { setEscolha(null); recarregar(); toast.success("Nível atualizado."); },
    onError: falha,
  });
  const desligar = useMutation({
    mutationFn: () => desligarFn({ data: {} }),
    onSuccess: () => { setEscolha(null); setCodigoPedido(false); recarregar(); toast.success("WhatsApp desligado. Você não receberá mais mensagens por lá."); },
    onError: falha,
  });
  const errado = useMutation({
    mutationFn: () => erradoFn({ data: {} }),
    onSuccess: () => toast.success("Avisamos o seu mentor para corrigir o número."),
    onError: falha,
  });

  const caixa = "rounded-xl bg-card p-5 ring-1 ring-black/5 dark:ring-white/10";
  if (isLoading) return <div className={caixa}><Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>;
  if (isError || !data) return <div className={caixa}><p className="text-sm text-destructive">Não foi possível carregar esta seção. Recarregue a página.</p></div>;
  if (!data.temCadastro) {
    return (
      <div className={caixa}>
        <h2 className="text-sm font-medium">Recebimento de mensagens</h2>
        <p className="mt-1 text-sm text-muted-foreground">Esta opção vale para o seu cadastro de aluno, e este login não tem um.</p>
      </div>
    );
  }

  const leitura = data.somenteLeitura;
  const vigente = data.vigente && !data.numeroMudou ? data.vigente : null;
  const atual: Escolha = vigente ? vigente.nivel : "so_email";
  const ocupado = pedir.isPending || confirmar.isPending || mudar.isPending || desligar.isPending;
  const escolhido = escolha ?? atual;
  const opcoes: Escolha[] = ["essencial", "completo", "so_email"];

  return (
    <div className={`${caixa} space-y-4`}>
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-medium">Recebimento de mensagens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha se quer receber avisos da plataforma no seu WhatsApp. Sem isso, os avisos chegam só por e-mail.
          </p>
        </div>
      </div>

      {leitura && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-800">
          Só o aluno pode ativar. Você está vendo esta tela como o aluno vê.
        </p>
      )}

      <div className="text-sm">
        <span className="text-muted-foreground">Telefone do cadastro: </span>
        <span className="font-medium">{data.telefoneMascarado ?? "não informado"}</span>
        {!leitura && data.telefoneMascarado && (
          <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={() => errado.mutate()} disabled={errado.isPending}>
            Meu número está errado
          </Button>
        )}
      </div>

      {data.numeroMudou && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-800">
          O telefone do seu cadastro mudou depois da sua autorização. Por segurança, o WhatsApp está pausado: confirme o número de novo abaixo.
        </p>
      )}
      {vigente && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          WhatsApp ligado — nível {ROTULO_NIVEL[vigente.nivel].titulo}, desde {dataBR(vigente.desde)}.
        </p>
      )}

      <div role="radiogroup" aria-label="Nível de mensagens" className="grid gap-2">
        {opcoes.map((o) => {
          const sel = escolhido === o;
          const titulo = o === "so_email" ? "Só e-mail" : ROTULO_NIVEL[o].titulo;
          const desc = o === "so_email" ? "Nada por WhatsApp. Os avisos continuam chegando por e-mail." : ROTULO_NIVEL[o].descricao;
          return (
            <button
              key={o} type="button" role="radio" aria-checked={sel} disabled={leitura || ocupado}
              onClick={() => { setEscolha(o); if (o === "so_email") setCodigoPedido(false); }}
              className={`rounded-lg p-3 text-left ring-1 transition disabled:opacity-60 ${sel ? "bg-accent/10 ring-2 ring-accent" : "ring-black/10 hover:bg-muted dark:ring-white/15"}`}
            >
              <span className="block text-sm font-medium">{titulo}{o === atual ? " · atual" : ""}</span>
              <span className="block text-xs text-muted-foreground">{desc}</span>
            </button>
          );
        })}
      </div>

      {!leitura && escolhido === "so_email" && atual !== "so_email" && (
        <Button variant="outline" onClick={() => desligar.mutate()} disabled={ocupado}>
          {desligar.isPending ? "Desligando…" : "Desligar o WhatsApp agora"}
        </Button>
      )}

      {!leitura && escolhido !== "so_email" && escolhido !== atual && (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">Termo de autorização ({data.termo.versao})</p>
            <p className="mt-1 text-sm">{data.termo.texto}</p>
          </div>
          {atual !== "so_email" && vigente ? (
            <Button onClick={() => mudar.mutate(escolhido)} disabled={ocupado}>
              {mudar.isPending ? "Salvando…" : `Aceitar o termo e mudar para ${ROTULO_NIVEL[escolhido].titulo}`}
            </Button>
          ) : !codigoPedido ? (
            <Button onClick={() => pedir.mutate(escolhido)} disabled={ocupado || !data.telefoneMascarado}>
              {pedir.isPending ? "Enviando…" : "Enviar código para o meu WhatsApp"}
            </Button>
          ) : (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); confirmar.mutate(); }}>
              <label htmlFor="codigo-whatsapp" className="text-sm font-medium">Código que chegou no seu WhatsApp</label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="codigo-whatsapp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
                  value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} className="w-36 tracking-widest"
                />
                <Button type="submit" disabled={ocupado || codigo.length !== 6}>
                  {confirmar.isPending ? "Confirmando…" : "Confirmar e aceitar o termo"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => pedir.mutate(escolhido as NivelWhatsapp)} disabled={ocupado}>
                  Enviar outro código
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O código vale {data.limites.validadeMinutos} minutos. Ao confirmar, você aceita o termo acima.
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
