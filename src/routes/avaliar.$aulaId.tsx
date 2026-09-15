/**
 * "Avaliar esta aula" — a tela onde o aluno cai ao abrir o link que o
 * professor copiou e mandou pelo grupo (#286).
 *
 * Fica FORA do layout `_app` e fora de `/aluno` de propósito, mesmo motivo do
 * `/checkin/$aulaId`: `/aluno` tem um `beforeLoad` que redireciona ANTES de
 * qualquer componente renderizar, então não dá para mostrar um recado
 * explicando o que aconteceu — só um pulo direto para o login, sem
 * explicação nenhuma. Aqui a pessoa pode chegar deslogada, e a tela precisa
 * dizer o que fazer.
 *
 * Regra da tela: nunca acusar e nunca deixar branco. Quem não tem presença
 * válida lê exatamente por quê, não um erro técnico. Quem já avaliou vê a
 * própria nota, sem poder editar (regra da #231).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dadosParaAvaliarAula, avaliarAula } from "@/lib/classroom.functions";
import { mensagemDeErro } from "@/lib/erro-legivel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BrandMark } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CalendarOff, CircleCheck, Hand, Lock, LogIn, Star, Video } from "lucide-react";

export const Route = createFileRoute("/avaliar/$aulaId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Avaliar aula" }, { name: "robots", content: "noindex" }] }),
  component: AvaliarAula,
});

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-muted/30 p-5">
      <BrandMark />
      <div className="w-full max-w-md rounded-2xl bg-card p-6 ring-1 ring-black/5">{children}</div>
    </div>
  );
}

function Estrelas({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-4", i <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
      ))}
    </span>
  );
}

function SeletorEstrelas({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className="p-1"
          aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
        >
          <Star className={cn("size-7", i <= valor ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
        </button>
      ))}
    </div>
  );
}

function AvaliarAula() {
  const { aulaId } = Route.useParams();
  const [logado, setLogado] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session));
  }, []);

  const dadosFn = useServerFn(dadosParaAvaliarAula);
  const avaliarFn = useServerFn(avaliarAula);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["avaliar-aula", aulaId],
    queryFn: () => dadosFn({ data: { aula_id: aulaId } }),
    enabled: logado === true,
  });

  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");

  const avaliar = useMutation({
    mutationFn: () =>
      avaliarFn({ data: { aula_id: aulaId, estrelas, comentario: comentario.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Avaliação enviada. Obrigado!");
      refetch();
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  if (logado === null) {
    return <Casca><p className="text-sm text-muted-foreground">Carregando…</p></Casca>;
  }

  // ---------------------------------------------------------------- deslogado
  if (!logado) {
    return (
      <Casca>
        <Star className="size-7 text-primary" />
        <h1 className="mt-3 text-lg font-semibold">Link de avaliação — falta entrar</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Entre com o seu e-mail e senha para avaliar a aula. Você volta direto para cá.
        </p>
        <Button asChild className="mt-5 w-full">
          <Link to="/auth" search={{ next: `/avaliar/${aulaId}` }}>
            <LogIn className="size-4" /> Entrar e avaliar
          </Link>
        </Button>
      </Casca>
    );
  }

  if (isLoading) {
    return <Casca><p className="text-sm text-muted-foreground">Carregando…</p></Casca>;
  }

  const aula = data?.aula;

  // ------------------------------------------------------------- sem a aula
  if (!aula) {
    return (
      <Casca>
        <Hand className="size-7 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">Não encontrei esta aula</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Confira o link com o professor — ele pode ter mudado ou a aula pode ter sido removida.
        </p>
      </Casca>
    );
  }

  // ------------------------------------------------------------------ cancelada
  if (aula.cancelada) {
    return (
      <Casca>
        <CalendarOff className="size-7 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">Este encontro foi cancelado</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {aula.titulo} foi cancelada pelo professor — não há o que avaliar aqui.
        </p>
      </Casca>
    );
  }

  // --------------------------------------------------------------- gravada
  if (aula.gravada) {
    return (
      <Casca>
        <Video className="size-7 text-primary" />
        <h1 className="mt-3 text-lg font-semibold">Esta aula não usa link de avaliação</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {aula.titulo} é uma aula gravada — avalie pela tela do treinamento, depois de marcar como
          concluída.
        </p>
      </Casca>
    );
  }

  // ---------------------------------------------------------- lista aberta
  if (!aula.fechada) {
    return (
      <Casca>
        <Lock className="size-7 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">Ainda não dá para avaliar</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {aula.titulo} ainda não foi fechada pelo professor. O link volta a funcionar assim que ele
          fechar a lista de presença desta aula.
        </p>
      </Casca>
    );
  }

  // ------------------------------------------------------------ sem presença
  if (!data.presenca_valida) {
    return (
      <Casca>
        <Hand className="size-7 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">Não é possível avaliar esta aula</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Não consta presença sua em <strong>{aula.titulo}</strong>. Peça ao mentor para verificar a
          sua presença.
        </p>
      </Casca>
    );
  }

  // -------------------------------------------------------------- já avaliou
  if (data.minha_avaliacao) {
    return (
      <Casca>
        <CircleCheck className="size-8 text-emerald-600" />
        <h1 className="mt-3 text-lg font-semibold">Você já avaliou esta aula</h1>
        <p className="mt-1 text-sm text-muted-foreground">{aula.titulo}</p>
        <div className="mt-4 rounded-lg bg-muted/60 p-3">
          <Estrelas n={data.minha_avaliacao.estrelas} />
          {data.minha_avaliacao.comentario && (
            <p className="mt-2 text-sm leading-relaxed">{data.minha_avaliacao.comentario}</p>
          )}
        </div>
      </Casca>
    );
  }

  // ------------------------------------------------------------------ avaliar
  return (
    <Casca>
      <Star className="size-7 text-primary" />
      <h1 className="mt-3 text-lg font-semibold">Avalie esta aula</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {aula.titulo}
        {aula.treinamento_titulo ? ` · ${aula.treinamento_titulo}` : ""}
      </p>
      <div className="mt-4 space-y-3">
        <SeletorEstrelas valor={estrelas} onChange={setEstrelas} />
        <Textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Comentário (opcional)"
          rows={3}
        />
        <Button
          className="w-full"
          disabled={estrelas < 1 || avaliar.isPending}
          onClick={() => avaliar.mutate()}
        >
          {avaliar.isPending ? "Enviando…" : "Enviar avaliação"}
        </Button>
      </div>
    </Casca>
  );
}
