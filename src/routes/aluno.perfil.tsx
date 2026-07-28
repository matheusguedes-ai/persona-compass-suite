import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyStudentProfile, updateMyStudentProfile } from "@/lib/student.functions";
import { supabase } from "@/integrations/supabase/client";
import { AvatarUpload } from "@/components/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, KeyRound, MailCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/aluno/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil" }, { name: "robots", content: "noindex" }] }),
  component: PerfilAluno,
});

function PerfilAluno() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyStudentProfile);
  const saveFn = useServerFn(updateMyStudentProfile);
  const { data, isLoading } = useQuery({ queryKey: ["meu-perfil-aluno"], queryFn: () => getFn() });

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [novoEmail, setNovoEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    const p = data?.pessoa;
    if (!p) return;
    setNome(p.full_name ?? "");
    setTelefone(p.phone ?? "");
    setFoto(p.avatar_url ?? null);
  }, [data]);

  const salvar = useMutation({
    mutationFn: (v: { full_name: string; phone: string | null; avatar_url: string | null }) =>
      saveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meu-perfil-aluno"] });
      qc.invalidateQueries({ queryKey: ["student-area"] });
      toast.success("Dados atualizados — seu mentor já vê a mudança");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function trocarEmail(e: React.FormEvent) {
    e.preventDefault();
    setTrocando(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() });
      if (error) throw new Error(error.message);
      toast.success("Enviamos um link de confirmação para o novo email.");
      setNovoEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível trocar o email.");
    } finally {
      setTrocando(false);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== senha2) {
      toast.error("As duas senhas precisam ser iguais.");
      return;
    }
    setTrocando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw new Error(error.message);
      toast.success("Senha alterada.");
      setSenha(""); setSenha2("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível trocar a senha.");
    } finally {
      setTrocando(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!data?.pessoa) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
        <AlertCircle className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-base font-medium">Ainda não encontramos seu cadastro</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Sua conta precisa usar o mesmo email que seu mentor cadastrou. Assim que isso acontecer,
          seus dados aparecem aqui para você editar.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que você mudar aqui aparece na hora para o seu mentor.
        </p>
      </div>

      {/* -------- Dados -------- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate({ full_name: nome.trim(), phone: telefone.trim() || null, avatar_url: foto });
        }}
        className="space-y-5 rounded-xl bg-card p-6 ring-1 ring-black/5"
      >
        <div className="space-y-2">
          <Label>Foto</Label>
          <AvatarUpload url={foto} nome={nome} userId={data.user_id} onChange={setFoto} />
          <p className="text-[11px] text-muted-foreground">PNG, JPG ou WEBP, até 2 MB.</p>
        </div>
        <div className="space-y-2">
          <Label>Nome completo</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} maxLength={160} />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={40} placeholder="(11) 99999-0000" />
        </div>
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </form>

      {/* -------- Acesso -------- */}
      <div className="space-y-5 rounded-xl bg-card p-6 ring-1 ring-black/5">
        <div>
          <h2 className="text-sm font-semibold">Acesso à conta</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Email e senha que você usa para entrar.
          </p>
        </div>

        <form onSubmit={trocarEmail} className="space-y-2">
          <Label>Email de entrada</Label>
          <Input value={data.email_login ?? ""} disabled readOnly />
          <div className="flex flex-wrap gap-2 pt-1">
            <Input
              type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)}
              placeholder="Novo email" className="min-w-48 flex-1" maxLength={200}
            />
            <Button type="submit" variant="outline" disabled={trocando || !novoEmail.trim()}>
              <MailCheck className="size-4" /> Trocar email
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Vamos enviar um link para o novo endereço. A troca só vale depois que você clicar nele —
            até lá, continue entrando com o email atual.
          </p>
        </form>

        <form onSubmit={trocarSenha} className="space-y-2 border-t border-black/5 pt-5">
          <Label>Nova senha</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} placeholder="Mínimo 6 caracteres" />
            <Input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} minLength={6} placeholder="Repita a senha" />
          </div>
          <Button type="submit" variant="outline" disabled={trocando || senha.length < 6} className="mt-1">
            <KeyRound className="size-4" /> Alterar senha
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Se você entra com o Google, não precisa de senha aqui.
          </p>
        </form>
      </div>
    </div>
  );
}
