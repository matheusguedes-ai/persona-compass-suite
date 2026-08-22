/**
 * Criação de senha, logo depois do link de acesso — a mesma tela para aluno
 * e para mentor promovido (o primeiro acesso de um mentor promovido "a frio",
 * sem login prévio, usa este caminho: ver `promover_a_mentor`, migração
 * 20260730010000, e o Anexo 3 de docs/plano-area-do-aluno.md).
 *
 * Chega aqui quem clicou no link enviado por e-mail — e só. A sessão já existe
 * quando a tela abre; se não existir, é porque a pessoa digitou o endereço na
 * mão, e aí não há o que fazer além de mandar pedir o link.
 */
import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

export function CriarSenha() {
  const [pronto, setPronto] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // O link deixa a sessão pronta; sem ela, não há identidade para associar.
    supabase.auth.getSession().then(({ data }) => setPronto(!!data.session));
  }, []);

  async function salvar() {
    if (senha.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirma) return toast.error("As duas senhas não são iguais.");
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) return toast.error(mensagemDeErro(error));
    toast.success("Senha criada. Bem-vindo!");
    window.location.href = "/aluno";
  }

  if (pronto === null) {
    return <Casca><p className="text-sm text-muted-foreground">Carregando…</p></Casca>;
  }

  if (!pronto) {
    return (
      <Casca>
        <h1 className="text-xl font-semibold">Link expirado ou já usado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Peça um novo link na tela de entrada com o seu e-mail. Cada link vale por uma hora e
          só pode ser usado uma vez.
        </p>
        <Button className="mt-5 w-full" onClick={() => { window.location.href = "/auth"; }}>
          Pedir um novo link
        </Button>
      </Casca>
    );
  }

  return (
    <Casca>
      <KeyRound className="size-8 text-primary" />
      <h1 className="mt-3 text-xl font-semibold">Escolha sua senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A partir daqui, você entra com o seu e-mail e essa senha.
      </p>
      <div className="mt-6 space-y-3">
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
            className="mt-1.5"
            onKeyDown={(e) => e.key === "Enter" && void salvar()}
          />
        </div>
      </div>
      <Button className="mt-5 w-full" onClick={() => void salvar()} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar e entrar"}
      </Button>
    </Casca>
  );
}

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 ring-1 ring-black/5">{children}</div>
    </div>
  );
}

export const Route = createFileRoute("/criar-senha")({
  head: () => ({ meta: [{ title: "Criar senha" }, { name: "robots", content: "noindex" }] }),
  component: CriarSenha,
});
