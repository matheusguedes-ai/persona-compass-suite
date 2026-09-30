/**
 * WhatsApp — teste de conexão (#291 F1a). Só aparece para o DONO da conta (aba em Configurações),
 * e o servidor confere de novo a cada chamada: esconder a aba não é a proteção.
 *
 * Nenhum envio sai daqui: a tela pede ao servidor "mande um teste para este número" e mostra o
 * resultado. O número digitado vai só ao servidor; o registro guarda a versão mascarada.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mensagemDeErro } from "@/lib/erro-legivel";
import { getWhatsappPainel, sendWhatsappTest, TEXTO_DO_TESTE } from "@/lib/canal.functions";

const ESTADO: Record<string, { titulo: string; ok: boolean; ajuda: string }> = {
  conectada: { titulo: "Conectado", ok: true, ajuda: "A instância está conectada ao WhatsApp." },
  desconectada: { titulo: "Desconectado", ok: false, ajuda: "A instância perdeu a conexão com o WhatsApp. Reconecte pelo painel da Zapster (QR code)." },
  desligada: { titulo: "Desligado", ok: false, ajuda: "A instância está desligada no painel da Zapster." },
  nao_configurada: { titulo: "Ainda não configurado", ok: false, ajuda: "Faltam as variáveis ZAPSTER_API_TOKEN e ZAPSTER_INSTANCE_ID nos Secrets do projeto." },
  indisponivel: { titulo: "Não consegui consultar", ok: false, ajuda: "" },
};

export function AbaWhatsapp() {
  const painelFn = useServerFn(getWhatsappPainel);
  const testeFn = useServerFn(sendWhatsappTest);
  const qc = useQueryClient();
  const [numero, setNumero] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["whatsapp-painel"],
    queryFn: () => painelFn(),
    retry: false,
  });

  const testar = useMutation({
    mutationFn: () => testeFn({ data: { numero } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-painel"] });
      if (r.status === "enviado") toast.success("Mensagem de teste enviada");
      else toast.error(`Não enviou: ${r.motivo}`);
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Verificando…</p>;
  if (error || !data) {
    return (
      <div className="max-w-2xl rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-800">
        {mensagemDeErro(error as Error, undefined, "Não consegui abrir o painel do WhatsApp.")}
      </div>
    );
  }

  const estado = ESTADO[data.conexao.estado] ?? ESTADO.indisponivel;
  const ajuda = data.conexao.estado === "indisponivel" ? data.conexao.motivo : estado.ajuda;
  const restantes = Math.max(0, data.testes.limite - data.testes.usados);

  return (
    <div className="max-w-2xl space-y-4">
      <div
        className={
          estado.ok
            ? "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-800"
            : "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-800"
        }
      >
        <div className="flex gap-3">
          {estado.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <AlertCircle className="mt-0.5 size-5 shrink-0" />}
          <div className="text-sm">
            <p className="font-medium">WhatsApp: {estado.titulo}</p>
            {ajuda && <p className="opacity-90">{ajuda}</p>}
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : null} Verificar de novo
        </Button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); testar.mutate(); }}
        className="space-y-2 rounded-xl bg-card p-5 ring-1 ring-black/5 dark:ring-white/10"
      >
        <Label htmlFor="whatsapp-numero">Enviar mensagem de teste</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="whatsapp-numero"
            className="min-w-64 flex-1"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="(18) 99999-9999"
            inputMode="tel"
            maxLength={40}
          />
          <Button type="submit" disabled={testar.isPending || numero.trim() === "" || restantes === 0}>
            {testar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {testar.isPending ? "Enviando…" : "Enviar mensagem de teste"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Vai chegar: “{TEXTO_DO_TESTE}”. Digite DDD + número com o 9 (11 dígitos). Restam{" "}
          <span className="font-medium">{restantes}</span> de {data.testes.limite} testes hoje.
        </p>
        {testar.data && (
          <p className={testar.data.status === "enviado" ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-destructive"}>
            {testar.data.status === "enviado" ? "Enviado — a Zapster aceitou a mensagem." : `Falhou: ${testar.data.motivo}`}
          </p>
        )}
      </form>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5 dark:ring-white/10">
        <div className="border-b border-black/5 px-5 py-3 dark:border-white/10">
          <h2 className="text-sm font-semibold">Últimos envios</h2>
        </div>
        {data.recentes.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum envio ainda.</p>
        ) : (
          <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
            {data.recentes.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <span className="font-medium">{l.tipo === "teste_conexao" ? "Teste de conexão" : l.tipo}</span>
                  <span className="text-muted-foreground"> · {l.canal} · {l.destino_mascarado ?? "—"}</span>
                  {l.motivo_falha && <p className="text-xs text-destructive">{l.motivo_falha}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={l.status === "enviado" ? "text-emerald-700 dark:text-emerald-300" : l.status === "falhou" ? "text-destructive" : "text-muted-foreground"}>
                    {l.status === "enviado" ? "aceito pela Zapster" : l.status}
                  </span>
                  <span className="text-muted-foreground">{new Date(l.criado_em).toLocaleString("pt-BR")}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
