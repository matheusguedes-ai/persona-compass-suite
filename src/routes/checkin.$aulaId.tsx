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

  const confirmar = useMutation({
    mutationFn: () => confirmarFn({ data: { aula_id: aulaId } }),
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

      <Button
        className="mt-5 w-full"
        disabled={confirmar.isPending}
        onClick={() => confirmar.mutate()}
      >
        {confirmar.isPending ? "Confirmando…" : "Estou presente"}
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
      {motivo === "sem_aula" && <Recado>Não encontrei esta aula. Confira o QR com o professor.</Recado>}
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
