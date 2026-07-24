import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    try {
      const target = safeNext(next);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("auth:next", target);
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) {
        setError(result.error.message ?? "Falha ao entrar com Google.");
        setBusy(false);
        return;
      }
      if (result?.redirected) return;
      // Popup flow: session set. Redirect.
      const saved = sessionStorage.getItem("auth:next") ?? "/";
      sessionStorage.removeItem("auth:next");
      if (saved === "/") nav({ to: "/" });
      else window.location.href = saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao entrar com Google.");
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const target = safeNext(next);
    const redirectAfterAuth = () => {
      // Consent route lives at /.lovable/oauth/consent — use full navigation so
      // TanStack Router picks up the escaped segment cleanly.
      window.location.href = target;
    };
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
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      // Auto-confirm está ativo: a sessão já vem pronta.
      if (!data.session) {
        const signIn = await supabase.auth.signInWithPassword({ email, password });
        if (signIn.error) {
          setBusy(false);
          setError(signIn.error.message);
          return;
        }
      }
      if (target === "/") nav({ to: "/" });
      else redirectAfterAuth();
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
              {mode === "signin" ? "Bem-vindo de volta" : "Criar conta"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin" ? "Entre com suas credenciais." : "Cadastre-se com email e senha."}
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
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>Sem conta?{" "}<button type="button" className="font-medium text-accent hover:underline" onClick={() => setMode("signup")}>Criar agora</button></>
            ) : (
              <>Já tem conta?{" "}<button type="button" className="font-medium text-accent hover:underline" onClick={() => setMode("signin")}>Entrar</button></>
            )}
          </p>
          <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">
            <Link to="/" className="hover:underline">voltar ao início</Link>
          </p>
        </form>
      </div>
    </div>
  );
}