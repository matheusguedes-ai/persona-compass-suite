import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { acceptInvite, dadosDoConvite, criarContaDoConvite } from "@/lib/team.functions";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
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
        setErro(mensagemDeErro(e, undefined, "Não foi possível aceitar o convite."));
        setEstado("erro");
      }
    })();
    return () => { vivo = false; };
  }, [token, aceitarFn, nav]);

  if (estado === "precisa_login") {
    return <CriarConta token={token} onPronto={() => window.location.reload()} />;
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

/**
 * Criação da conta de quem chegou pelo convite.
 *
 * Antes, sem conta, a tela mandava a pessoa para o login — onde ela não tinha
 * como entrar, porque conta nenhuma existia. O convite chegava e morria ali.
 *
 * A senha pode ser escolhida aqui direto: o token do link já é a prova de que o
 * e-mail é dela — ele só existe na mensagem enviada para aquele endereço. É a
 * mesma lógica de um link de redefinir senha.
 */
function CriarConta({ token, onPronto }: { token: string; onPronto: () => void }) {
  const dadosFn = useServerFn(dadosDoConvite);
  const criarFn = useServerFn(criarContaDoConvite);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["convite", token],
    queryFn: () => dadosFn({ data: { token } }),
  });

  async function criar() {
    if (senha.length < 8) return setFalha("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirma) return setFalha("As duas senhas não são iguais.");
    setOcupado(true);
    setFalha(null);
    try {
      const r = await criarFn({ data: { token, senha } });
      const { error } = await supabase.auth.signInWithPassword({ email: r.email, password: senha });
      if (error) {
        // Conta já existia com outra senha: o convite não serve para trocá-la.
        setFalha(
          r.jaExistia
            ? "Você já tem uma conta com este e-mail. Entre com a sua senha atual para aceitar o convite."
            : mensagemDeErro(error),
        );
        setOcupado(false);
        return;
      }
      onPronto();
    } catch (e) {
      setFalha(mensagemDeErro(e, undefined, "Não consegui criar a conta."));
      setOcupado(false);
    }
  }

  if (data && !data.valido) {
    return (
      <Shell>
        <AlertCircle className="mx-auto size-10 text-amber-500" />
        <h1 className="mt-3 text-lg font-semibold">Convite indisponível</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.motivo}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-lg font-semibold">
        {data?.nome ? `${data.nome.split(" ")[0]}, ` : ""}crie sua senha
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {data
          ? `Você foi convidado para atuar como ${data.papel} em ${data.empresa}.`
          : "Carregando o convite…"}
      </p>
      {data?.email && (
        <p className="mt-3 rounded-lg bg-muted/50 p-2.5 text-sm">
          Sua entrada será com <strong>{data.email}</strong>
        </p>
      )}
      <div className="mt-5 space-y-3 text-left">
        <div>
          <label className="text-sm font-medium">Senha</label>
          <Input
            type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
            className="mt-1.5" placeholder="pelo menos 8 caracteres" autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium">Repita a senha</label>
          <Input
            type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)}
            className="mt-1.5" onKeyDown={(e) => e.key === "Enter" && void criar()}
          />
        </div>
      </div>
      {falha && <p className="mt-3 text-sm text-destructive">{falha}</p>}
      <Button className="mt-5 w-full" onClick={() => void criar()} disabled={ocupado || !data?.valido}>
        {ocupado ? "Criando…" : "Criar conta e aceitar"}
      </Button>
      <button
        type="button"
        className="mt-3 text-xs text-muted-foreground hover:underline"
        onClick={() => { window.location.href = `/auth?next=/convite-equipe/${token}`; }}
      >
        Já tenho conta nesta plataforma
      </button>
    </Shell>
  );
}
