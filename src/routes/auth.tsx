import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { solicitarAcessoAluno } from "@/lib/acesso-aluno.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Métrica Humana" },
      { name: "description", content: "Acesse a plataforma de assessments." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  component: AuthPage,
});

// Only allow same-origin relative paths so we cannot be pushed to an external URL.
function safeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function AuthPage() {
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "acesso">("signin");
  const [busy, setBusy] = useState(false);
  const pedirAcesso = useServerFn(solicitarAcessoAluno);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      // Login com Google direto pelo Supabase (sem depender do Lovable).
      // O Supabase leva a pessoa ao Google e, ao voltar, restaura a sessão no app.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        setError(error.message ?? "Falha ao entrar com Google.");
        setBusy(false);
        return;
      }
      // Em caso de sucesso, o navegador é redirecionado ao Google automaticamente.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao entrar com Google.");
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const target = safeNext(next);
    const redirectAfterAuth = () => {
      // Consent route lives at /.lovable/oauth/consent — use full navigation so
      // TanStack Router picks up the escaped segment cleanly.
      window.location.href = target;
    };
    if (mode === "acesso") {
      // A resposta é sempre a mesma, com cadastro ou sem: ver o cabeçalho de
      // acesso-aluno.functions.ts. Dizer "e-mail não encontrado" deixaria
      // qualquer um descobrir quem são os avaliados de um mentor.
      try {
        const r = await pedirAcesso({ data: { email } });
        setInfo(r.mensagem);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não consegui enviar agora. Tente de novo.");
      }
      setBusy(false);
      return;
    }
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      if (target === "/") nav({ to: "/" });
      else redirectAfterAuth();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      // Após cadastro, deslogar (caso a sessão tenha sido criada automaticamente)
      // e enviar a pessoa para o fluxo de login com as credenciais escolhidas.
      await supabase.auth.signOut();
      setBusy(false);
      setPassword("");
      setMode("signin");
      setInfo("Conta criada com sucesso. Entre com seu email e senha para continuar.");
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2" style={{ fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif' }}>
      <div className="hidden flex-col justify-between bg-zinc-900 p-12 text-zinc-100 lg:flex">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
          <span className="grid size-6 place-items-center rounded bg-accent text-accent-foreground">M</span>
          Métrica Humana
        </div>
        <div>
          <p className="max-w-[38ch] text-2xl font-light leading-snug tracking-tight text-zinc-100">
            "Ferramentas de assessment que revelam o comportamento por trás de cada decisão."
          </p>
          <p className="mt-4 text-xs font-mono uppercase tracking-wider text-zinc-500">Analytical Workspace</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <form className="w-full max-w-sm space-y-5" onSubmit={submit}>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "acesso" ? "Primeiro acesso" : mode === "signin" ? "Bem-vindo de volta" : "Criar conta"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "acesso"
                ? "Se o seu mentor já te cadastrou, informe o e-mail dele e enviamos um link para você entrar e escolher sua senha."
                : mode === "signin" ? "Entre com suas credenciais." : "Cadastre-se com email e senha."}
            </p>
          </div>
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={signInWithGoogle}>
            <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.48l2.63-2.53C16.85 3.4 14.66 2.4 12 2.4 6.98 2.4 2.9 6.48 2.9 11.5S6.98 20.6 12 20.6c6.93 0 8.9-4.87 8.3-9.5H12z"/>
            </svg>
            Continuar com Google
          </Button>
          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou com email
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" required placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== "acesso" && (
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          {info && <p className="text-sm text-accent" role="status">{info}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Aguarde…" : mode === "acesso" ? "Enviar link de acesso" : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {mode === "acesso" ? (
              <>Já tem senha?{" "}<button type="button" className="font-medium text-accent hover:underline" onClick={() => { setMode("signin"); setError(null); setInfo(null); }}>Entrar</button></>
            ) : mode === "signin" ? (
              <>Sem conta?{" "}<button type="button" className="font-medium text-accent hover:underline" onClick={() => { setMode("signup"); setError(null); setInfo(null); }}>Criar agora</button></>
            ) : (
              <>Já tem conta?{" "}<button type="button" className="font-medium text-accent hover:underline" onClick={() => { setMode("signin"); setError(null); setInfo(null); }}>Entrar</button></>
            )}
          </p>
          {mode !== "acesso" && (
            <p className="text-center text-xs text-muted-foreground">
              Seu mentor te cadastrou e você ainda não tem senha?{" "}
              <button
                type="button" className="font-medium text-accent hover:underline"
                onClick={() => { setMode("acesso"); setError(null); setInfo(null); }}
              >
                Primeiro acesso
              </button>
            </p>
          )}
          <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">
            <Link to="/" className="hover:underline">voltar ao início</Link>
          </p>
        </form>
      </div>
    </div>
  );
}