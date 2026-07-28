import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { acceptInvite } from "@/lib/team.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/convite-equipe/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Convite para a equipe" }, { name: "robots", content: "noindex" }] }),
  component: ConviteEquipePage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="rounded-xl bg-card p-8 text-center ring-1 ring-black/5">{children}</div>
    </div>
  );
}

function ConviteEquipePage() {
  const { token } = Route.useParams();
  const nav = useNavigate();
  const aceitarFn = useServerFn(acceptInvite);
  const [estado, setEstado] = useState<"checando" | "precisa_login" | "aceitando" | "pronto" | "erro">("checando");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      if (!data.session) {
        setEstado("precisa_login");
        return;
      }
      setEstado("aceitando");
      try {
        await aceitarFn({ data: { token } });
        if (!vivo) return;
        setEstado("pronto");
        // Dá um instante para a pessoa ler a confirmação antes de entrar.
        setTimeout(() => nav({ to: "/" }), 1600);
      } catch (e) {
        if (!vivo) return;
        setErro(e instanceof Error ? e.message : "Não foi possível aceitar o convite.");
        setEstado("erro");
      }
    })();
    return () => { vivo = false; };
  }, [token, aceitarFn, nav]);

  if (estado === "precisa_login") {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Você foi convidado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre com o <span className="font-medium text-foreground">mesmo email</span> que recebeu o convite. Se ainda
          não tem conta, crie uma com esse email — depois voltamos para cá automaticamente.
        </p>
        <Button
          className="mt-5 w-full"
          onClick={() => nav({ to: "/auth", search: { next: `/convite-equipe/${token}` } })}
        >
          Entrar para aceitar
        </Button>
      </Shell>
    );
  }

  if (estado === "erro") {
    return (
      <Shell>
        <AlertCircle className="mx-auto size-10 text-amber-500" />
        <h1 className="mt-3 text-lg font-semibold">Não deu para aceitar</h1>
        <p className="mt-1 text-sm text-muted-foreground">{erro}</p>
        <Button variant="outline" className="mt-5 w-full" onClick={() => nav({ to: "/" })}>
          Ir para a plataforma
        </Button>
      </Shell>
    );
  }

  if (estado === "pronto") {
    return (
      <Shell>
        <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        <h1 className="mt-3 text-lg font-semibold">Convite aceito</h1>
        <p className="mt-1 text-sm text-muted-foreground">Entrando na plataforma…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">Verificando seu convite…</p>
    </Shell>
  );
}
