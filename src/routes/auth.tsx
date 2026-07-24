import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Métrica Humana" },
      { name: "description", content: "Acesse a plataforma de assessments." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
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
        <form
          className="w-full max-w-sm space-y-5"
          onSubmit={(e) => { e.preventDefault(); nav({ to: "/" }); }}
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
            <p className="mt-1 text-sm text-muted-foreground">Entre com suas credenciais.</p>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" required placeholder="voce@empresa.com" /></div>
          <div className="space-y-2"><Label>Senha</Label><Input type="password" required placeholder="••••••••" /></div>
          <Button type="submit" className="w-full">Entrar</Button>
          <p className="text-center text-xs text-muted-foreground">
            Prototipagem: <Link to="/" className="font-medium text-accent hover:underline">acessar plataforma</Link>
          </p>
        </form>
      </div>
    </div>
  );
}