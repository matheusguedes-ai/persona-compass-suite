/**
 * A tela de check-in, do lado de quem dá a aula.
 *
 * Três coisas acontecem aqui, e as duas últimas são o que realmente esvazia a
 * fila na porta:
 *
 * 1. O QR, que se renova sozinho a cada minuto. O servidor manda um LOTE de
 *    códigos e a tela gira localmente — se dependesse de uma chamada por minuto,
 *    a aba adormecida no projetor voltaria exibindo código velho com cara de
 *    válido, e a turma levaria "expirado" sem ter feito nada errado.
 * 2. O contador ao vivo ("12 de 20"). Sem ele os alunos vão até a mesa perguntar
 *    "funcionou?" — a fila nasce da falta de confirmação, não do software.
 * 3. O pré-voo: quem do grupo ainda não tem senha. Esse aluno TRAVA no dia,
 *    porque o link de primeiro acesso chega por e-mail e abre no navegador do
 *    app de e-mail, onde o passe do scan não existe. Saber isso na véspera vale
 *    mais que qualquer mensagem de erro bonita.
 */
import { mensagemDeErro } from "@/lib/erro-legivel";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { abrirCheckin, marcarPresencaManual, travarLocalDaAula } from "@/lib/classroom.functions";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CalendarClock, Check, CircleCheck, Hand, MapPin, QrCode, RefreshCw, TriangleAlert, UserX,
} from "lucide-react";
import { distanciaLegivel } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const HORA = { hour: "2-digit", minute: "2-digit" } as const;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", HORA);

export function CheckinDialog({ aulaId, onFechar }: { aulaId: string; onFechar: () => void }) {
  const qc = useQueryClient();
  const abrirFn = useServerFn(abrirCheckin);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["checkin", aulaId],
    queryFn: () => abrirFn({ data: { aula_id: aulaId } }),
    // Recarrega o lote e a lista de presenças. Curto o bastante para a turma ver
    // o contador subir, longo o bastante para não pesar no wifi da sala.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5" /> Check-in da aula
          </DialogTitle>
          <DialogDescription>
            {data?.aula.titulo ?? "…"}
            {data?.aula.local ? ` · ${data.aula.local}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Abrindo o check-in…</p>}
        {error && (
          <p className="text-sm text-destructive">{mensagemDeErro(error)}</p>
        )}

        {data && !data.janela && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-center gap-2 font-medium">
              <CalendarClock className="size-4" /> Esta aula ainda não tem data e hora
            </p>
            <p className="mt-1">
              O check-in valida o horário para saber quem chegou atrasado, então ele só abre depois
              que a aula tiver início e fim. Defina o horário em “Editar aula”.
            </p>
          </div>
        )}

        {data?.janela && (
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <div className="space-y-3">
              <QrAoVivo
                aulaId={aulaId}
                codigos={data.codigos}
                aberta={data.janela.aberta}
                janela={data.janela}
                onRenovar={() => refetch()}
                recarregando={isFetching}
              />
              <TravaDeLocal
                aulaId={aulaId}
                trava={data.trava}
                onMudou={() => qc.invalidateQueries({ queryKey: ["checkin", aulaId] })}
              />
            </div>
            <Turma
              aulaId={aulaId}
              turma={data.turma}
              presencas={data.presencas}
              comecaEm={data.aula.comeca_em}
              onMudou={() => {
                qc.invalidateQueries({ queryKey: ["checkin", aulaId] });
                qc.invalidateQueries({ queryKey: ["treinamento"] });
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QrAoVivo({
  aulaId, codigos, aberta, janela, onRenovar, recarregando,
}: {
  aulaId: string;
  codigos: Array<{ codigo: string; vale_ate: string }>;
  aberta: boolean;
  janela: { inicio: string; fim: string };
  onRenovar: () => void;
  recarregando: boolean;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const ultimo = useRef<string | null>(null);

  // Um tique por segundo só para escolher o código da vez e mostrar o relógio.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // O código válido AGORA, escolhido do lote pela hora de expirar. Se o lote
  // acabou (aba dormiu muito), pede um novo em vez de exibir código morto.
  const atual = useMemo(
    () => codigos.find((c) => new Date(c.vale_ate).getTime() > agora) ?? null,
    [codigos, agora],
  );
  const vencido = !atual;

  useEffect(() => {
    if (vencido) onRenovar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vencido]);

  // `qrcode` entra por import dinâmico: ele só faz sentido nesta tela, e não
  // deve pesar no bundle que o aluno baixa no celular da sala.
  useEffect(() => {
    if (!atual || atual.codigo === ultimo.current) return;
    ultimo.current = atual.codigo;
    let vivo = true;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      // A origem vem do navegador, não de variável de ambiente: com domínio
      // próprio ou no preview, um SITE_URL fixo geraria QR apontando para outro
      // host — e o cookie do passe cairia no domínio errado.
      const url = `${window.location.origin}/api/public/checkin/${aulaId}?c=${encodeURIComponent(atual.codigo)}`;
      const texto = await QRCode.toString(url, {
        type: "svg", margin: 1, errorCorrectionLevel: "M", width: 320,
      });
      if (vivo) setSvg(texto);
    })().catch(() => setSvg(null));
    return () => { vivo = false; };
  }, [atual, aulaId]);

  const segundos = atual ? Math.max(0, Math.round((new Date(atual.vale_ate).getTime() - agora) / 1000)) : 0;

  return (
    <div className="space-y-3">
      {!aberta && (
        <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          O check-in aceita confirmações entre <strong>{hhmm(janela.inicio)}</strong> e{" "}
          <strong>{hhmm(janela.fim)}</strong>. Fora disso o código é recusado — antes da hora
          inclusive.
        </div>
      )}
      <div className="relative overflow-hidden rounded-xl bg-white p-3 ring-1 ring-black/10">
        {svg ? (
          <div
            className={cn("[&>svg]:h-auto [&>svg]:w-full", !aberta && "opacity-30")}
            // O SVG é gerado aqui mesmo, a partir de um código do próprio
            // servidor — não há entrada de usuário neste caminho.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex aspect-square items-center justify-center text-sm text-muted-foreground">
            Gerando o código…
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {recarregando ? "atualizando…" : `este código vale ~${segundos}s`}
        </span>
        <button onClick={onRenovar} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn("size-3", recarregando && "animate-spin")} /> renovar
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        O código muda a cada minuto: guardado, ele morre. Mas repassado{" "}
        <strong>na hora</strong> ainda funciona — quem quiser marcar presença de casa consegue, e é
        para isso que existe a trava de local abaixo. Peça para abrirem a{" "}
        <strong>câmera do celular</strong> e apontarem. Se não abrir, é o wifi: conectar primeiro e
        escanear de novo.
      </p>
    </div>
  );
}

/**
 * A trava de local: um clique, a coordenada de quem está com o projetor.
 *
 * O QR rotativo prova quando, não onde. Enquanto o professor não travar, a foto
 * do código repassada no grupo vale — e a tela diz isso com todas as letras em
 * vez de deixar o professor supor que está protegido.
 */
function TravaDeLocal({
  aulaId, trava, onMudou,
}: {
  aulaId: string;
  trava: { raio_m: number; travado_em: string | null } | null;
  onMudou: () => void;
}) {
  const travarFn = useServerFn(travarLocalDaAula);
  const [pegando, setPegando] = useState(false);

  const salvar = useMutation({
    mutationFn: async (soltar: boolean) => {
      if (soltar) return travarFn({ data: { aula_id: aulaId, lat: null, lng: null } });
      setPegando(true);
      try {
        const { posicaoAtual } = await import("@/lib/geo");
        const p = await posicaoAtual();
        if (!p) throw new Error("SEM_GPS");
        return await travarFn({
          data: {
            aula_id: aulaId,
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            // O raio absorve a imprecisão do próprio aparelho do professor: se o
            // GPS dele erra 200 m, travar em 300 m reprovaria a turma inteira.
            raio_m: Math.min(5000, Math.max(300, Math.round((p.coords.accuracy || 0) * 2))),
          },
        });
      } finally {
        setPegando(false);
      }
    },
    onSuccess: (r) => {
      toast.success(r.travada ? "Aula travada neste local." : "Trava de local removida.");
      onMudou();
    },
    onError: (e) => {
      toast.error(
        (e as Error).message === "SEM_GPS"
          ? "Não consegui a localização deste aparelho. Libere o acesso no navegador e tente de novo."
          : mensagemDeErro(e),
      );
    },
  });

  const ocupado = salvar.isPending || pegando;

  return (
    <div className="rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <MapPin className="size-3.5" />
        {trava ? "Travada neste local" : "Sem trava de local"}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {trava ? (
          <>
            Só confirma presença quem estiver a até{" "}
            <strong>{distanciaLegivel(trava.raio_m)}</strong> daqui
            {trava.travado_em ? ` (travada ${hhmm(trava.travado_em)})` : ""}. Quem receber o QR pelo
            grupo é recusado. <strong>Confira se a sala é esta</strong> — travada na aula passada,
            no endereço antigo, ela reprova a turma toda.
          </>
        ) : (
          <>
            Qualquer pessoa com o código do minuto confirma, de onde estiver. Trave para exigir que
            o aluno esteja no encontro — faça isso <strong>na sala</strong>, com o seu aparelho.
          </>
        )}
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant={trava ? "outline" : "default"} disabled={ocupado}
          onClick={() => salvar.mutate(false)}>
          {ocupado ? "Lendo o GPS…" : trava ? "Travar de novo, aqui" : "Travar neste local"}
        </Button>
        {trava && (
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => salvar.mutate(true)}>
            Soltar
          </Button>
        )}
      </div>
    </div>
  );
}

function Turma({
  aulaId, turma, presencas, comecaEm, onMudou,
}: {
  aulaId: string;
  turma: Array<{ person_id: string; nome: string; email: string | null; temLogin: boolean }>;
  presencas: Array<{
    person_id: string; nome: string; origem: string;
    escaneado_em: string | null; registrado_em: string; situacao: string | null;
    distancia_m: number | null;
  }>;
  comecaEm: string | null;
  onMudou: () => void;
}) {
  const marcarFn = useServerFn(marcarPresencaManual);
  const marcar = useMutation({
    // `situacao: null` = devolver ao cálculo, não "apagar". A linha criada aqui
    // nasce SEM situação gravada de propósito: assim o cálculo continua valendo
    // para ela, em vez de congelar "presente" na pedra.
    mutationFn: (v: { person_id: string; situacao?: "ausente" | null }) =>
      marcarFn({ data: { aula_id: aulaId, ...v } }),
    onSuccess: () => { onMudou(); toast.success("Lista atualizada"); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const porPessoa = new Map(presencas.map((p) => [p.person_id, p]));
  // Só presente e atrasado contam como confirmados: falta justificada é falta, e
  // exibi-la no contador faria a turma parecer mais cheia do que estava.
  const confirmados = presencas.filter(
    (p) => p.situacao !== "ausente" && p.situacao !== "justificado",
  ).length;
  const semLogin = turma.filter((t) => !t.temLogin && !porPessoa.has(t.person_id));

  /**
   * Atraso — só quando existe régua: hora do SCAN e horário da aula. Presença
   * lançada à mão não tem hora de chegada, e usar a hora do lançamento faria
   * "o professor lançou na manhã seguinte" virar 934 minutos de atraso.
   */
  function atraso(escaneadoEm: string | null): string | null {
    if (!comecaEm || !escaneadoEm) return null;
    const diff = Math.trunc((new Date(escaneadoEm).getTime() - new Date(comecaEm).getTime()) / 60_000);
    if (diff <= 0) return null;
    return `${diff} min depois do início`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">
          {confirmados} de {turma.length} confirmaram
        </p>
        <p className="text-[11px] text-muted-foreground">atualiza sozinho</p>
      </div>

      {semLogin.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlert className="size-3.5" />
            {semLogin.length === 1
              ? "1 aluno ainda não tem senha"
              : `${semLogin.length} alunos ainda não têm senha`}
          </p>
          <p className="mt-1">
            {semLogin.map((s) => s.nome.split(" ")[0]).join(", ")} — o QR vai travar para
            {semLogin.length === 1 ? " ele" : " eles"}. Marque a presença à mão aqui, e peça que
            façam o primeiro acesso depois, com calma.
          </p>
        </div>
      )}

      <ul className="max-h-[46vh] divide-y divide-black/5 overflow-y-auto rounded-lg ring-1 ring-black/5">
        {turma.length === 0 && (
          <li className="p-4 text-xs text-muted-foreground">
            Nenhum grupo com acesso a este treinamento ainda — sem turma, não há quem confirmar.
          </li>
        )}
        {turma.map((t) => {
          const p = porPessoa.get(t.person_id);
          const ausente = p?.situacao === "ausente";
          return (
            <li key={t.person_id} className="flex items-center gap-2 p-2.5">
              {p && !ausente ? (
                <CircleCheck className="size-4 shrink-0 text-emerald-600" />
              ) : ausente ? (
                <UserX className="size-4 shrink-0 text-destructive" />
              ) : (
                <span className="size-4 shrink-0 rounded-full border border-dashed border-black/20" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{t.nome}</p>
                {p ? (
                  <p className="text-[11px] text-muted-foreground">
                    {p.escaneado_em ? hhmm(p.escaneado_em) : `lançado ${hhmm(p.registrado_em)}`}
                    {p.origem === "manual" ? " · marcado pelo professor" : " · pelo QR"}
                    {atraso(p.escaneado_em) ? ` · ${atraso(p.escaneado_em)}` : ""}
                    {p.situacao === "justificado" ? " · falta justificada" : ""}
                    {typeof p.distancia_m === "number" ? ` · a ${distanciaLegivel(p.distancia_m)}` : ""}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {t.temLogin ? "ainda não confirmou" : "sem senha — só à mão"}
                  </p>
                )}
              </div>
              {p ? (
                <Button
                  variant="ghost" size="sm" className="shrink-0 text-[11px]"
                  disabled={marcar.isPending}
                  onClick={() =>
                    marcar.mutate({ person_id: t.person_id, situacao: ausente ? null : "ausente" })
                  }
                >
                  {ausente ? "estava presente" : "marcar ausente"}
                </Button>
              ) : (
                <Button
                  variant="outline" size="sm" className="shrink-0"
                  disabled={marcar.isPending}
                  onClick={() => marcar.mutate({ person_id: t.person_id })}
                >
                  <Hand className="size-3" /> presente
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Check className="mt-0.5 size-3 shrink-0" />
        A lista guarda como cada presença entrou — pelo QR ou pela sua mão. A tabela completa, com
        atraso e frequência acumulada, vem na próxima etapa.
      </p>
    </div>
  );
}
