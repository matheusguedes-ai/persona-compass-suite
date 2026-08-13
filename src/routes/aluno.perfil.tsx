import { meuPerfilVisivel, definirPerfilVisivel } from "@/lib/comunidade.functions";
import { Switch } from "@/components/ui/switch";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyStudentProfile, updateMyStudentProfile } from "@/lib/student.functions";
import { assinarMeuEnvio } from "@/lib/preview-upload.functions";
import { supabase } from "@/integrations/supabase/client";
import { AvatarUpload } from "@/components/avatar-upload";
import { RecortarImagem } from "@/components/recorte-imagem";
import { erroDeUpload } from "@/lib/erro-de-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle, KeyRound, MailCheck, ImageUp, Loader2, Trash2, Linkedin, Instagram, Globe,
} from "lucide-react";
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
  const [empresa, setEmpresa] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [site, setSite] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [trocando, setTrocando] = useState(false);

  // Banner: mesmo bucket e mesmas regras de armazenamento do avatar
  // ('avatares', pasta = próprio user_id) — só o prefixo do arquivo muda
  // (banner- em vez de foto-) e passa por um recorte horizontal antes.
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [paraRecortar, setParaRecortar] = useState<File | null>(null);
  const [enviandoBanner, setEnviandoBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const previaFn = useServerFn(assinarMeuEnvio);

  useEffect(() => {
    const p = data?.pessoa;
    if (!p) return;
    setNome(p.full_name ?? "");
    setTelefone(p.phone ?? "");
    setFoto(p.avatar_url ?? null);
    setEmpresa(p.company_name ?? "");
    setBanner(p.banner_url ?? null);
    setLinkedin(p.linkedin_url ?? "");
    setInstagram(p.instagram_url ?? "");
    setSite(p.site_url ?? "");
  }, [data]);

  async function enviarBanner(recortado: File) {
    if (!data?.user_id) return;
    setEnviandoBanner(true);
    try {
      const caminho = `${data.user_id}/banner-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("avatares").upload(caminho, recortado, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw new Error(erroDeUpload(error, "avatares"));
      const { data: pub } = supabase.storage.from("avatares").getPublicUrl(caminho);
      try {
        setBannerPreview((await previaFn({ data: { url: pub.publicUrl } })).url);
      } catch { /* sem preview agora */ }
      setBanner(pub.publicUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar o banner.");
    } finally {
      setEnviandoBanner(false);
    }
  }

  const salvar = useMutation({
    mutationFn: (v: {
      full_name: string; phone: string | null; avatar_url: string | null;
      company_name: string | null; banner_url: string | null;
      linkedin_url: string | null; instagram_url: string | null; site_url: string | null;
    }) => saveFn({ data: v }),
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
          salvar.mutate({
            full_name: nome.trim(),
            phone: telefone.trim() || null,
            avatar_url: foto,
            company_name: empresa.trim() || null,
            banner_url: banner,
            linkedin_url: linkedin.trim() || null,
            instagram_url: instagram.trim() || null,
            site_url: site.trim() || null,
          });
        }}
        className="space-y-5 rounded-xl bg-card p-6 ring-1 ring-black/5"
      >
        <div className="space-y-2">
          <Label>Banner de capa</Label>
          <div className="relative h-28 w-full overflow-hidden rounded-lg bg-gradient-to-r from-muted to-muted/60">
            {(bannerPreview ?? banner) && (
              <img src={bannerPreview ?? banner ?? undefined} alt="" className="size-full object-cover" />
            )}
            {enviandoBanner && (
              <div className="absolute inset-0 grid place-items-center bg-black/40">
                <Loader2 className="size-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <input
            ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setParaRecortar(f);
              if (bannerInputRef.current) bannerInputRef.current.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={enviandoBanner} onClick={() => bannerInputRef.current?.click()}>
              <ImageUp className="size-4" /> {banner ? "Trocar banner" : "Escolher banner"}
            </Button>
            {banner && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setBannerPreview(null); setBanner(null); }}>
                <Trash2 className="size-4" /> Remover
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Imagem horizontal, PNG, JPG ou WEBP. Sem banner, aparece um fundo neutro no seu lugar.
          </p>
          <RecortarImagem
            arquivo={paraRecortar}
            aspecto={3}
            onCancelar={() => setParaRecortar(null)}
            onConcluir={(recortado) => { setParaRecortar(null); enviarBanner(recortado); }}
          />
        </div>
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
          <Label>Empresa</Label>
          <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} maxLength={160} placeholder="Onde você trabalha" />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={40} placeholder="(11) 99999-0000" />
        </div>

        <div className="space-y-3 border-t border-black/5 pt-5">
          <Label className="text-xs text-muted-foreground">Redes sociais (opcional)</Label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Linkedin className="size-4 shrink-0 text-muted-foreground" />
              {/* type="text" de propósito: type="url" ativa a validação nativa
                  do navegador, que bloqueia o envio ANTES de chegar ao
                  servidor — a pessoa vê a mensagem do navegador (que pode nem
                  estar em português), não a nossa. Deixando texto livre, todo
                  envio passa pelo mesmo validador (urlOpcional) e a mensagem
                  é sempre a nossa, sempre em português. */}
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} maxLength={600} placeholder="https://linkedin.com/in/…" />
            </div>
            <div className="flex items-center gap-2">
              <Instagram className="size-4 shrink-0 text-muted-foreground" />
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} maxLength={600} placeholder="https://instagram.com/…" />
            </div>
            <div className="flex items-center gap-2">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <Input value={site} onChange={(e) => setSite(e.target.value)} maxLength={600} placeholder="https://seusite.com" />
            </div>
          </div>
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
    <VisibilidadeDoPerfil />
    </div>
  );
}

/**
 * A pessoa decide se os colegas de grupo veem os dados dela.
 *
 * Nasce DESLIGADO para todo mundo, e isso é intencional: ligar por padrão
 * exporia o contato de quem já estava cadastrado sem ninguém ter sido
 * perguntado. Aqui é escolha.
 *
 * Foto, nome e cargo aparecem sempre — são o que identifica a pessoa na lista
 * de membros, e sem eles a lista não serve para nada. O que a chave controla é
 * contato e profissão.
 */
function VisibilidadeDoPerfil() {
  const qc = useQueryClient();
  const lerFn = useServerFn(meuPerfilVisivel);
  const salvarFn = useServerFn(definirPerfilVisivel);
  const { data } = useQuery({ queryKey: ["perfil-visivel"], queryFn: () => lerFn() });

  const salvar = useMutation({
    mutationFn: (v: boolean) => salvarFn({ data: { visivel: v } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["perfil-visivel"] });
      toast.success(v ? "Seus dados agora aparecem para o grupo." : "Seus dados ficaram ocultos.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">Meus dados para o grupo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando ligado, quem está nos seus grupos pode ver seu e-mail, telefone e profissão.
            Sua foto, nome e cargo aparecem de qualquer forma.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Seus resultados de teste nunca aparecem aqui.
          </p>
        </div>
        <Switch
          checked={data?.visivel ?? false}
          onCheckedChange={(v) => salvar.mutate(v)}
          disabled={salvar.isPending}
        />
      </div>
    </div>
  );
}
