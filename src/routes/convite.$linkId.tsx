import { SeloEmpresa } from "@/components/selo-empresa";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { BrandMark, useApplyBrand, type Brand } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDeErro } from "@/lib/erro-legivel";
import {
  continuarConviteComConta, enviarAcessoPeloConvite, meuCadastroNoConvite,
} from "@/lib/convite.functions";

export const Route = createFileRoute("/convite/$linkId")({
  head: () => ({ meta: [{ title: "Convite para responder" }, { name: "robots", content: "noindex" }] }),
  // `continuar=1` = a pessoa acabou de entrar na conta PARA responder este
  // convite (volta do login, do Google ou do link por e-mail). Só aí a tela
  // segue sozinha — ver o cabeçalho de convite.functions.ts.
  validateSearch: (s: Record<string, unknown>) => ({
    continuar: s.continuar === 1 || s.continuar === "1" || s.continuar === true ? true : undefined,
  }),
  component: ConvitePage,
});

type Info = {
  id: string;
  brand?: Brand | null;
  title: string | null;
  tests: string[];
  expires_at: string | null;
  remaining: number | null;
  blocked: "not_found" | "inactive" | "expired" | "full" | null;
  message: string | null;
};

type Destino = { kind: "assessment" | "response"; id: string };

type Etapa =
  | { tipo: "carregando" }
  | { tipo: "form" }
  | { tipo: "ja_cadastrado" }
  | { tipo: "confirmar" }
  | { tipo: "entrar_com_outro" }
  | { tipo: "logado"; nome: string }
  | { tipo: "continuando" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <div className="rounded-xl bg-card p-6 ring-1 ring-black/5 sm:p-8">{children}</div>
    </div>
  );
}

function IconeGoogle() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.48l2.63-2.53C16.85 3.4 14.66 2.4 12 2.4 6.98 2.4 2.9 6.48 2.9 11.5S6.98 20.6 12 20.6c6.93 0 8.9-4.87 8.3-9.5H12z" />
    </svg>
  );
}

function ConvitePage() {
  const { linkId } = Route.useParams();
  const { continuar } = Route.useSearch();
  const nav = useNavigate();
  const meuCadastroFn = useServerFn(meuCadastroNoConvite);
  const continuarFn = useServerFn(continuarConviteComConta);
  const enviarAcessoFn = useServerFn(enviarAcessoPeloConvite);

  const [info, setInfo] = useState<Info | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "carregando" });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailDoCadastro, setEmailDoCadastro] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  useApplyBrand(info?.brand);

  const voltarAqui = `/convite/${linkId}?continuar=1`;

  function irPara(d: Destino) {
    if (d.kind === "assessment") nav({ to: "/bateria/$assessmentId", params: { assessmentId: d.id } });
    else nav({ to: "/responder/$responseId", params: { responseId: d.id } });
  }

  async function seguirComConta(nome: string) {
    setEtapa({ tipo: "continuando" });
    setErro(null);
    try {
      irPara(await continuarFn({ data: { link_id: linkId } }));
    } catch (e) {
      setErro(mensagemDeErro(e, undefined, "Não foi possível abrir o teste agora. Tente de novo."));
      setEtapa({ tipo: "logado", nome });
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      let json: Info;
      try {
        const r = await fetch(`/api/public/invite/${linkId}`);
        json = (await r.json()) as Info & { error?: string; message?: string };
        if (!alive) return;
        if (!r.ok && r.status === 404) {
          setLoadError(json.message ?? "Link não encontrado.");
          return;
        }
        setInfo(json);
      } catch {
        if (alive) setLoadError("Falha de conexão. Tente novamente.");
        return;
      }

      // Já logado: esta conta tem cadastro com quem mandou o convite?
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (!data.session) {
        setEtapa({ tipo: "form" });
        return;
      }
      try {
        const eu = await meuCadastroFn({ data: { link_id: linkId } });
        if (!alive) return;
        // Link lotado ou vencido só deixa passar quem tem teste aberto para retomar.
        if (!eu.tem_cadastro || (json.blocked && !eu.tem_aberta)) {
          setEtapa({ tipo: "form" });
          return;
        }
        if (continuar) await seguirComConta(eu.primeiro_nome);
        else setEtapa({ tipo: "logado", nome: eu.primeiro_nome });
      } catch {
        if (alive) setEtapa({ tipo: "form" });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  async function enviarFormulario(confirmacao?: "sou_novo") {
    setBusy(true);
    setErro(null);
    try {
      const r = await fetch(`/api/public/invite/${linkId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, phone, confirmacao }),
      });
      const json = (await r.json()) as Partial<Destino> & { situacao?: string; message?: string; error?: string };
      if (!r.ok) {
        setErro(json.message ?? json.error ?? "Não foi possível continuar.");
        setBusy(false);
        return;
      }
      if (json.situacao === "ja_cadastrado") {
        setEmailDoCadastro(email);
        setEtapa({ tipo: "ja_cadastrado" });
        setBusy(false);
        return;
      }
      if (json.situacao === "confirmar_identidade") {
        setEtapa({ tipo: "confirmar" });
        setBusy(false);
        return;
      }
      irPara(json as Destino);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setBusy(false);
    }
  }

  async function pedirLinkDeAcesso() {
    setBusy(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await enviarAcessoFn({ data: { link_id: linkId, email: emailDoCadastro } });
      setAviso(r.mensagem);
    } catch (e) {
      setErro(mensagemDeErro(e, { email: "E-mail" }, "Não consegui enviar agora. Tente de novo."));
    }
    setBusy(false);
  }

  async function entrarComGoogle() {
    setErro(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${voltarAqui}` },
    });
    if (error) setErro(mensagemDeErro(error, undefined, "Falha ao entrar com Google."));
  }

  async function sair() {
    await supabase.auth.signOut();
    setErro(null);
    setEtapa({ tipo: "form" });
  }

  function trocarEtapa(nova: Etapa) {
    setErro(null);
    setAviso(null);
    setEtapa(nova);
  }

  if (loadError) {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{loadError}</p>
        </div>
      </Shell>
    );
  }
  if (!info || etapa.tipo === "carregando") {
    return <Shell><p className="text-center text-sm text-muted-foreground">Carregando…</p></Shell>;
  }
  if (etapa.tipo === "continuando") {
    return <Shell><p className="text-center text-sm text-muted-foreground">Abrindo o teste…</p></Shell>;
  }

  if (info.blocked && etapa.tipo !== "logado") {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="mx-auto size-10 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold">Link indisponível</h1>
          <p className="mt-1 text-sm text-muted-foreground">{info.message}</p>
        </div>
      </Shell>
    );
  }

  /** Os três jeitos de entrar — iguais para todo mundo, para não revelar como a conta foi criada. */
  const opcoesDeEntrada = (pedirEmail: boolean) => (
    <div className="mt-6 space-y-3">
      <Button className="w-full" onClick={() => nav({ to: "/auth", search: { next: voltarAqui } })}>
        Entrar na minha conta <ArrowRight className="size-4" />
      </Button>
      <Button variant="outline" className="w-full" onClick={() => void entrarComGoogle()}>
        <IconeGoogle /> Continuar com Google
      </Button>

      <div className="pt-3">
        <p className="text-sm font-medium">Não lembra a senha, ou nunca criou uma?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mandamos um link para o seu e-mail. Com ele você entra sem senha e volta direto para este teste.
        </p>
        {pedirEmail && (
          <div className="mt-3 space-y-2">
            <Label htmlFor="email-cadastro">E-mail do seu cadastro</Label>
            <Input
              id="email-cadastro" type="email" placeholder="voce@exemplo.com" maxLength={200}
              value={emailDoCadastro} onChange={(e) => setEmailDoCadastro(e.target.value)}
            />
          </div>
        )}
        <Button
          variant="outline" className="mt-3 w-full"
          disabled={busy || !emailDoCadastro.trim()}
          onClick={() => void pedirLinkDeAcesso()}
        >
          <Mail className="size-4" /> {busy ? "Enviando…" : "Receber link de acesso por e-mail"}
        </Button>
      </div>

      {aviso && <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">{aviso}</p>}
      {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}
    </div>
  );

  return (
    <Shell>
      {info.brand && <div className="mb-5"><BrandMark brand={info.brand} size={28} /></div>}

      {etapa.tipo === "logado" && (
        <>
          <h1 className="text-xl font-semibold tracking-tight">Olá{etapa.nome ? `, ${etapa.nome}` : ""}!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Você já está conectado. Continue para responder o teste deste convite.
          </p>
          <Button className="mt-6 w-full" onClick={() => void seguirComConta(etapa.nome)}>
            Continuar para o teste <ArrowRight className="size-4" />
          </Button>
          {erro && <p className="mt-3 text-sm text-destructive" role="alert">{erro}</p>}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Não é você?{" "}
            <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => void sair()}>
              Sair e responder com outro nome
            </button>
          </p>
        </>
      )}

      {etapa.tipo === "ja_cadastrado" && (
        <>
          <h1 className="text-xl font-semibold tracking-tight">Você já tem cadastro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este e-mail já está cadastrado. Entre na sua conta para responder — depois de entrar, você
            volta direto para este teste.
          </p>
          {opcoesDeEntrada(false)}
          <p className="mt-5 text-center text-xs text-muted-foreground">
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => trocarEtapa({ tipo: "form" })}>
              Voltar e corrigir meus dados
            </button>
          </p>
        </>
      )}

      {etapa.tipo === "confirmar" && (
        <>
          <h1 className="text-xl font-semibold tracking-tight">Antes de continuar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Você já tem cadastro conosco com outro e-mail?</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Perguntamos para não criar um cadastro repetido — assim todas as suas respostas ficam no mesmo lugar.
          </p>
          <div className="mt-6 space-y-3">
            <Button className="w-full" onClick={() => { setEmailDoCadastro(""); trocarEtapa({ tipo: "entrar_com_outro" }); }}>
              Sim, já tenho cadastro
            </Button>
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => void enviarFormulario("sou_novo")}>
              {busy ? "Preparando…" : "Não, é meu primeiro cadastro"}
            </Button>
          </div>
          {erro && <p className="mt-3 text-sm text-destructive" role="alert">{erro}</p>}
        </>
      )}

      {etapa.tipo === "entrar_com_outro" && (
        <>
          <h1 className="text-xl font-semibold tracking-tight">Entre com o cadastro que você já tem</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use o e-mail com que você se cadastrou. Depois de entrar, você volta direto para este teste.
          </p>
          {opcoesDeEntrada(true)}
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Não lembra qual e-mail usou? Fale com quem te enviou este convite.
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => trocarEtapa({ tipo: "confirmar" })}>
              Voltar
            </button>
          </p>
        </>
      )}

      {etapa.tipo === "form" && (
        <>
          <h1 className="text-xl font-semibold tracking-tight">{info.title || "Convite para responder"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha seus dados para começar. Leva poucos minutos e suas respostas ficam com o mentor que enviou o convite.
          </p>

          {info.tests.length > 0 && (
            <div className="mt-5 rounded-lg bg-muted/40 p-4 ring-1 ring-black/5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {info.tests.length === 1 ? "Você vai responder" : `Você vai responder ${info.tests.length} inventários`}
              </p>
              <ul className="mt-2 space-y-1">
                {info.tests.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-3.5 text-muted-foreground" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void enviarFormulario(); }}>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome" required minLength={2} maxLength={160} placeholder="Como você quer ser chamado"
                value={fullName} onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" required maxLength={160} placeholder="voce@exemplo.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone" type="tel" required minLength={8} maxLength={40} placeholder="(11) 99999-0000"
                value={phone} onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Preparando…" : <>Começar <ArrowRight className="size-4" /></>}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Já tem conta?{" "}
            <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => nav({ to: "/auth", search: { next: voltarAqui } })}>
              Entrar e responder
            </button>
          </p>

          <div className="mt-4 space-y-1 text-center text-xs text-muted-foreground">
            {info.expires_at && <p>Disponível até {new Date(info.expires_at).toLocaleString("pt-BR")}</p>}
            {info.remaining != null && (
              <p>{info.remaining === 1 ? "Resta 1 vaga" : `Restam ${info.remaining} vagas`}</p>
            )}
          </div>
        </>
      )}

      <SeloEmpresa nome={info?.brand?.company_seal_name} cnpj={info?.brand?.company_cnpj} className="mt-10" />
    </Shell>
  );
}
