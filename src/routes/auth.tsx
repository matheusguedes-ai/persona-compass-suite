import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const emailRedirectTo = `${window.location.origin}${target}`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      setBusy(false);
      setError("Conta criada. Verifique seu email para confirmar, depois faça login.");
      setMode("signin");
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