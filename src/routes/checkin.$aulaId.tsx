/**
 * "Confirmar presença" — a tela onde o aluno cai depois de escanear.
 *
 * Fica FORA do layout `_app` e fora de `/aluno` de propósito: `_app` empurra
 * aluno para `/aluno`, e `/aluno` exige sessão antes de qualquer coisa. Aqui a
 * pessoa pode chegar deslogada, e a tela precisa explicar o que fazer em vez de
 * desviar.
 *
 * Regra da tela: nunca acusar e nunca deixar branco. Quem chega sem passe
 * (link repassado no grupo) lê "escaneie o QR na sala", não "código inválido".
 * Quem já confirmou vê a hora da própria presença — inclusive ao apertar F5,
 * que é o gesto natural de quem ficou na dúvida.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { confirmarPresenca, minhaPresenca } from "@/lib/classroom.functions";
import { supabase } from "@/integrations/supabase/client";
import { distanciaLegivel } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/lib/brand";
import { CalendarClock, CircleCheck, Hand, LogIn, MapPin, QrCode } from "lucide-react";

export const Route = createFileRoute("/checkin/$aulaId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Confirmar presença" }, { name: "robots", content: "noindex" }] }),
  component: Checkin,
});

const HORA = { hour: "2-digit", minute: "2-digit" } as const;

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-muted/30 p-5">
      <BrandMark />
      <div className="w-full max-w-md rounded-2xl bg-card p-6 ring-1 ring-black/5">{children}</div>
    </div>
  );
}

function Checkin() {
  const { aulaId } = Route.useParams();
  const [logado, setLogado] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session));
  }, []);

  const minhaFn = useServerFn(minhaPresenca);
  const confirmarFn = useServerFn(confirmarPresenca);

  // Só consulta depois de saber que há sessão: a server function exige Bearer.
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["minha-presenca", aulaId],
    queryFn: () => minhaFn({ data: { aula_id: aulaId } }),
    enabled: logado === true,
  });

  // A localização só é pedida quando a aula está travada num lugar. Pedir
  // sempre gastaria a permissão — negada uma vez, o navegador não pergunta de
  // novo — em aulas que nem usam, e aí a trava nasceria quebrada no dia em que
  // o professor a ligasse.
  const confirmar = useMutation({
    mutationFn: async () => {
      let onde: { lat?: number; lng?: number; precisao_m?: number } = {};
      if (data?.exige_local) {
        const { posicaoAtual } = await import("@/lib/geo");
        const p = await posicaoAtual();
        if (p) {
          onde = {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            precisao_m: p.coords.accuracy,
          };
        }
      }
      return confirmarFn({ data: { aula_id: aulaId, ...onde } });
    },
    onSuccess: () => refetch(),
  });

  if (logado === null) {
    return <Casca><p className="text-sm text-muted-foreground">Carregando…</p></Casca>;
  }

  // ---------------------------------------------------------------- deslogado
  if (!logado) {
    return (
      <Casca>
        <QrCode className="size-7 text-primary" />
        <h1 className="mt-3 text-lg font-semibold">Código lido — falta entrar</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Entre com o seu e-mail e senha para confirmar a presença. Você volta direto para cá.
        </p>
        <Button asChild className="mt-5 w-full">
          <Link to="/auth" search={{ next: `/checkin/${aulaId}` }}>
            <LogIn className="size-4" /> Entrar e confirmar
          </Link>
        </Button>
        <p className="mt-4 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <strong>Nunca criou senha?</strong> Não dá para resolver isso agora sem perder a leitura do
          código — peça ao professor para marcar a sua presença na lista. Você cria a senha depois,
          com calma, pelo link que chega no seu e-mail.
        </p>
      </Casca>
    );
  }

  const aula = data?.aula;
  const presenca = data?.presenca;

  // ------------------------------------------------------------- já confirmada
  if (presenca) {
    return (
      <Casca>
        <CircleCheck className="size-8 text-emerald-600" />
        <h1 className="mt-3 text-lg font-semibold">Presença confirmada</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {aula?.titulo ?? "Aula"} ·{" "}
          {new Date(presenca.quando).toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", ...HORA,
          })}
        </p>
        {presenca.origem === "manual" && (
          <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            Esta presença foi registrada pelo professor.
          </p>
        )}
        <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          Os pontos deste encontro entram no seu ranking quando o professor fechar a lista da aula.
        </p>
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link to="/aluno/classroom" search={{ ver: undefined }}>Ver o treinamento</Link>
        </Button>
      </Casca>
    );
  }

  const r = confirmar.data;
  const motivo = r && !r.ok ? r.motivo : null;

  return (
    <Casca>
      <QrCode className="size-7 text-primary" />
      <h1 className="mt-3 text-lg font-semibold">Confirmar presença</h1>
      {isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Carregando a aula…</p>
      ) : (
        <>
          <p className="mt-1 text-base font-medium">{aula?.titulo ?? "Aula do treinamento"}</p>
          <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {aula?.comeca_em && (
              <p className="flex items-center gap-1.5">
                <CalendarClock className="size-4 shrink-0" />
                {new Date(aula.comeca_em).toLocaleString("pt-BR", {
                  weekday: "long", day: "2-digit", month: "long", ...HORA,
                })}
              </p>
            )}
            {aula?.local && (
              <p className="flex items-center gap-1.5"><MapPin className="size-4 shrink-0" /> {aula.local}</p>
            )}
          </div>
        </>
      )}

      {data?.exige_local && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Esta aula confere o local. Ao confirmar, o celular vai pedir permissão de localização —
            ela serve só para checar que você está no encontro, e a plataforma guarda a{" "}
            <strong>distância</strong>, nunca o seu endereço.
          </span>
        </p>
      )}

      <Button
        className="mt-5 w-full"
        disabled={confirmar.isPending}
        onClick={() => confirmar.mutate()}
      >
        {confirmar.isPending
          ? data?.exige_local
            ? "Conferindo o local…"
            : "Confirmando…"
          : "Estou presente"}
      </Button>

      {confirmar.isError && (
        <Recado>
          Não deu para confirmar agora. Tente de novo — e se insistir, o professor pode registrar a
          sua presença na lista.
        </Recado>
      )}

      {motivo === "sem_passe" && (
        <Recado>
          <strong>Escaneie o QR na tela da sala.</strong> Esta página só confirma presença logo
          depois da leitura do código — abrir o link que alguém mandou não vale.
        </Recado>
      )}
      {motivo === "passe_usado" && (
        <Recado>
          Este código já foi usado para confirmar uma presença. Escaneie o QR de novo com o{" "}
          <strong>seu</strong> celular.
        </Recado>
      )}
      {motivo === "fora_da_janela" && (
        <Recado>
          O check-in desta aula está fechado
          {r && !r.ok && "fim" in r && r.fim
            ? ` — ele aceitou confirmações até ${new Date(r.fim).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", ...HORA })}`
            : ""}
          . Fale com o professor: ele pode registrar a sua presença.
        </Recado>
      )}
      {(motivo === "nao_e_aluno" || motivo === "sem_grupo") && (
        <Recado>
          <Hand className="mb-1 inline size-4" /> Esta conta não está na turma deste treinamento.
          Se você tem outro login como aluno, entre com ele; se não, peça ao professor para
          registrar a sua presença.
          <button
            className="mt-2 block underline"
            onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
          >
            Sair e entrar com outra conta
          </button>
        </Recado>
      )}
      {motivo === "sem_localizacao" && (
        <Recado>
          <MapPin className="mb-1 inline size-4" /> <strong>Falta liberar a localização.</strong>{" "}
          Esta aula confere se você está no encontro. Toque em “Estou presente” de novo e permita o
          acesso quando o celular perguntar — ou peça ao professor para registrar a sua presença.
        </Recado>
      )}
      {motivo === "longe" && (
        <Recado>
          <MapPin className="mb-1 inline size-4" /> Você está{" "}
          <strong>
            {r && !r.ok && "distancia_m" in r && typeof r.distancia_m === "number"
              ? distanciaLegivel(r.distancia_m)
              : "longe"}
          </strong>{" "}
          do local do encontro, e o check-in aceita até{" "}
          {r && !r.ok && "raio_m" in r && typeof r.raio_m === "number"
            ? distanciaLegivel(r.raio_m)
            : "o raio definido"}
          . Se você <strong>está</strong> na sala, o sinal do GPS pode ter falhado aqui dentro —
          peça ao professor para registrar a sua presença na lista.
        </Recado>
      )}
      {motivo === "sem_aula" && <Recado>Não encontrei esta aula. Confira o QR com o professor.</Recado>}
      {motivo === "cancelada" && (
        <Recado>
          Este encontro foi cancelado pelo professor. Sua presença não foi registrada — e não
          precisa ser. Quando ele remarcar, você recebe um aviso.
        </Recado>
      )}
    </Casca>
  );
}

function Recado({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}
