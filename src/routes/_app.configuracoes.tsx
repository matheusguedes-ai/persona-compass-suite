import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, upsertMyProfile, upsertConfiguracoesConta, REPORT_BLOCKS } from "@/lib/data.functions";
import { getMyMembership } from "@/lib/team.functions";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark, MARCA_PADRAO } from "@/lib/brand";
import { AvatarUpload } from "@/components/avatar-upload";
import { RecortarImagem } from "@/components/recorte-imagem";
import { assinarMeuEnvio } from "@/lib/preview-upload.functions";
import { CAMPOS, avisoDoCampo, erroDeArquivo, erroDeUpload } from "@/lib/erro-de-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, ImageUp, Loader2, Send, Trash2 } from "lucide-react";
import { getEmailStatus, listEmailLogs, sendTestEmail } from "@/lib/email.functions";
import { toast } from "sonner";
import {
  estadoDoGoogle, iniciarConexaoGoogle, desconectarGoogle,
} from "@/lib/google.functions";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Métrica Humana" },
      { name: "description", content: "Configure sua conta, marca, relatórios e mensagens." },
      { property: "og:title", content: "Configurações — Métrica Humana" },
      { property: "og:description", content: "Personalize a plataforma e ajuste suas preferências." },
    ],
  }),
  component: ConfiguracoesPage,
});

/** Rótulos e explicações dos blocos que o relatório pode esconder. */
const BLOCOS: Record<(typeof REPORT_BLOCKS)[number], { titulo: string; ajuda: string }> = {
  fatores: {
    titulo: "Gráfico das dimensões",
    ajuda: "As barras com a pontuação de cada dimensão do teste.",
  },
  narrativas: {
    titulo: "Textos de análise",
    ajuda: "Síntese, potencialidades, pontos a desenvolver e demais textos do perfil.",
  },
  derivados: {
    titulo: "Análises derivadas do DISC",
    ajuda: "Estilos de liderança, competências e índices calculados a partir do DISC.",
  },
  plano_acao: {
    titulo: "Plano de ação",
    ajuda: "As perguntas que o avaliado responde ao final para virar plano.",
  },
  observadores: {
    titulo: "Visão dos observadores (360°)",
    ajuda: "A comparação entre a autoavaliação e o que os observadores responderam.",
  },
};

const EXEMPLO_CONVITE =
  "Olá {nome}! Separei um inventário rápido para entendermos melhor o seu perfil. " +
  "Leva poucos minutos e o resultado a gente discute na nossa próxima conversa. Segue o link: {link}";
const EXEMPLO_LEMBRETE =
  "Oi {nome}, tudo bem? Passando para lembrar do inventário que te enviei. " +
  "O link continua valendo: {link}";
const EXEMPLO_RESULTADO =
  "{nome}, seu relatório ficou pronto! Dá uma olhada com calma e anote o que fizer sentido " +
  "para conversarmos: {link}";

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyProfile);
  const saveFn = useServerFn(upsertMyProfile);
  const saveContaFn = useServerFn(upsertConfiguracoesConta);
  const membershipFn = useServerFn(getMyMembership);
  const { data, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => getFn() });
  const { data: membership } = useQuery({ queryKey: ["my-membership"], queryFn: () => membershipFn() });
  // Sem resposta ainda, assume dono: é o caso da esmagadora maioria e evita a
  // tela "piscar" entre a versão reduzida e a completa.
  const souDono = (membership?.kind ?? "owner") === "owner";

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [brandColor, setBrandColor] = useState("#164e63");
  const [accentColor, setAccentColor] = useState("#0e7490");
  const [logoUrl, setLogoUrl] = useState("");
  // O bucket 'marca' é privado: logoUrl guarda o IDENTIFICADOR (o que salva).
  // Isto guarda a versão ASSINADA de um upload feito NESTA sessão, só para o
  // <img> ter o que mostrar antes de salvar. `null` cai no fallback — o que já
  // veio assinado de getMyProfile, ao abrir a tela.
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const previaLogoFn = useServerFn(assinarMeuEnvio);
  // Ícone do app (#235) — separado da logo: quadrado, para a tela de
  // instalar do celular. Mesmo esquema identificador/preview do logo acima.
  const [iconUrl, setIconUrl] = useState("");
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [paraRecortarIcone, setParaRecortarIcone] = useState<File | null>(null);
  const [enviandoIcone, setEnviandoIcone] = useState(false);
  // Painel lateral da tela de login (#261) — vertical, não quadrado como o
  // ícone. Mesmo esquema identificador/preview dos dois de cima.
  const [loginImagemUrl, setLoginImagemUrl] = useState("");
  const [loginImagemPreview, setLoginImagemPreview] = useState<string | null>(null);
  const [paraRecortarLoginImagem, setParaRecortarLoginImagem] = useState<File | null>(null);
  const [enviandoLoginImagem, setEnviandoLoginImagem] = useState(false);
  const [loginFrase, setLoginFrase] = useState("");
  const [loginRodape, setLoginRodape] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [allowPdf, setAllowPdf] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [hidden, setHidden] = useState<string[]>([]);
  const [inviteMsg, setInviteMsg] = useState("");
  const [reminderMsg, setReminderMsg] = useState("");
  const [resultMsg, setResultMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);
  const loginImagemFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = data?.profile;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setCompanyName(p.company_name ?? "");
    setBrandColor(p.brand_color ?? "#164e63");
    setAccentColor(p.brand_accent_color ?? "#0e7490");
    setLogoUrl(p.logo_url ?? "");
    setLogoPreview(null);
    setIconUrl(p.icon_url ?? "");
    setIconPreview(null);
    setLoginImagemUrl(p.login_imagem_url ?? "");
    setLoginImagemPreview(null);
    setLoginFrase(p.login_frase ?? "");
    setLoginRodape(p.login_rodape ?? "");
    setAvatarUrl(p.avatar_url ?? null);
    setSiteUrl(p.site_url ?? "");
    setSupportEmail(p.support_email ?? "");
    setAllowPdf(p.report_allow_pdf ?? true);
    setShowBrand(p.report_show_brand ?? true);
    setHidden(p.report_hidden_blocks ?? []);
    setInviteMsg(p.invite_message ?? "");
    setReminderMsg(p.reminder_message ?? "");
    setResultMsg(p.result_message ?? "");
  }, [data]);

  /** Perfil: nome e foto, qualquer um mexe no próprio. */
  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => saveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Alterações salvas");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  /** Marca, relatório, mensagens, remetente — reconfigura para todo mundo; só dono. */
  const saveConta = useMutation({
    mutationFn: (v: Record<string, unknown>) => saveContaFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      // A marca aplicada na sidebar/cabeçalho vem de outra consulta
      // (`getAccountBrand`, ver brand.tsx) — sem isto, o dono salva e só vê a
      // mudança na própria tela depois de recarregar a página.
      qc.invalidateQueries({ queryKey: ["account-brand"] });
      toast.success("Alterações salvas");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  /**
   * Sobe o arquivo direto para o armazenamento do Supabase, na pasta do próprio
   * usuário. O caminho leva a hora no nome para o navegador não continuar
   * mostrando o logo antigo do cache depois da troca.
   */
  async function enviarLogo(file: File) {
    const userId = data?.user_id;
    if (!userId) return;
    const erroTamanho = erroDeArquivo(file, "logo_marca");
    if (erroTamanho) {
      toast.error(erroTamanho);
      return;
    }
    setEnviando(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const caminho = `${userId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("marca").upload(caminho, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw new Error(erroDeUpload(error, "marca"));
      const { data: pub } = supabase.storage.from("marca").getPublicUrl(caminho);
      // Pede ao servidor a versão assinada deste MESMO arquivo que acabei de
      // enviar, só para o preview — o bucket privado não deixa o navegador
      // assinar sozinho. Se falhar, ainda salva certo; só o preview imediato
      // fica sem imagem até recarregar.
      try {
        setLogoPreview((await previaLogoFn({ data: { url: pub.publicUrl } })).url);
      } catch { /* sem preview agora — não impede salvar */ }
      setLogoUrl(pub.publicUrl);
      saveConta.mutate({ logo_url: pub.publicUrl });
    } catch (e) {
      toast.error(mensagemDeErro(e, undefined, "Falha ao enviar a imagem."));
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /**
   * O arquivo já chega RECORTADO (quadrado, via RecortarImagem) — aqui só
   * sobe para o bucket. Mesmo esquema de identificador+preview do logo, num
   * caminho próprio (`icone-`) para não colidir com o logo na mesma pasta.
   */
  async function enviarIcone(file: File) {
    const userId = data?.user_id;
    if (!userId) return;
    const erroTamanho = erroDeArquivo(file, "icone_marca");
    if (erroTamanho) {
      toast.error(erroTamanho);
      return;
    }
    setEnviandoIcone(true);
    try {
      const caminho = `${userId}/icone-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("marca").upload(caminho, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw new Error(erroDeUpload(error, "marca"));
      const { data: pub } = supabase.storage.from("marca").getPublicUrl(caminho);
      try {
        setIconPreview((await previaLogoFn({ data: { url: pub.publicUrl } })).url);
      } catch { /* sem preview agora — não impede salvar */ }
      setIconUrl(pub.publicUrl);
      saveConta.mutate({ icon_url: pub.publicUrl });
    } catch (e) {
      toast.error(mensagemDeErro(e, undefined, "Falha ao enviar o ícone."));
    } finally {
      setEnviandoIcone(false);
    }
  }

  /**
   * Imagem lateral da tela de login (#261) — mesmo esquema do ícone (chega já
   * RECORTADA, aqui só sobe), num caminho próprio (`login-`) e formato
   * vertical em vez de quadrado.
   */
  async function enviarLoginImagem(file: File) {
    const userId = data?.user_id;
    if (!userId) return;
    const erroTamanho = erroDeArquivo(file, "imagem_login");
    if (erroTamanho) {
      toast.error(erroTamanho);
      return;
    }
    setEnviandoLoginImagem(true);
    try {
      const caminho = `${userId}/login-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("marca").upload(caminho, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw new Error(erroDeUpload(error, "marca"));
      const { data: pub } = supabase.storage.from("marca").getPublicUrl(caminho);
      try {
        setLoginImagemPreview((await previaLogoFn({ data: { url: pub.publicUrl } })).url);
      } catch { /* sem preview agora — não impede salvar */ }
      setLoginImagemUrl(pub.publicUrl);
      saveConta.mutate({ login_imagem_url: pub.publicUrl });
    } catch (e) {
      toast.error(mensagemDeErro(e, undefined, "Falha ao enviar a imagem."));
    } finally {
      setEnviandoLoginImagem(false);
    }
  }

  const previewBrand = {
    company_name: companyName || null,
    logo_url: logoPreview ?? (logoUrl || null),
    brand_color: brandColor,
    brand_accent_color: accentColor,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {souDono
            ? "Personalize a plataforma, a identidade da marca e o que o avaliado vê."
            : "Seu nome e sua foto — como você aparece para a equipe."}
        </p>
      </div>

      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">{souDono ? "Perfil da conta" : "Meu perfil"}</TabsTrigger>
          {souDono && (
            <>
              <TabsTrigger value="marca">Marca</TabsTrigger>
              <TabsTrigger value="relatorio">Relatório</TabsTrigger>
              <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ---------------- Perfil ---------------- */}
        <TabsContent value="perfil" className="mt-6">
          <form
            onSubmit={(e) => { e.preventDefault(); save.mutate({ full_name: fullName.trim() || null, avatar_url: avatarUrl }); }}
            className="max-w-xl space-y-4 rounded-xl bg-card p-6 ring-1 ring-black/5"
          >
            <div className="space-y-2">
              <Label>Sua foto</Label>
              <AvatarUpload
                url={avatarUrl} nome={fullName || data?.email || null} userId={data?.user_id}
                onChange={(u) => { setAvatarUrl(u); save.mutate({ avatar_url: u }); }}
              />
              <p className="text-[11px] text-muted-foreground">
                Aparece no menu e para a sua equipe. {avisoDoCampo("avatar")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={data?.email ?? ""} disabled readOnly />
              <p className="text-[11px] text-muted-foreground">O email é gerenciado pela sua conta de acesso.</p>
            </div>
            <Button type="submit" disabled={save.isPending || isLoading}>
              {save.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </form>
        </TabsContent>

        {/* Marca, Relatório, Mensagens, Emails e Agenda reconfiguram a conta
            inteira — a lista de permissões nunca devia ter tratado isso como
            delegável. Só o dono, aqui E em cada server function chamada
            (a tela sumir não tranca nada sozinha). Ver Fecha #218. */}
        {souDono && (
          <>
        {/* ---------------- Marca ---------------- */}
        <TabsContent value="marca" className="mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveConta.mutate({
                company_name: companyName.trim() || null,
                brand_color: brandColor || null,
                brand_accent_color: accentColor || null,
                logo_url: logoUrl.trim() || null,
                site_url: siteUrl.trim() || null,
                support_email: supportEmail.trim() || null,
                login_frase: loginFrase.trim() || null,
                login_rodape: loginRodape.trim() || null,
              });
            }}
            className="max-w-xl space-y-6 rounded-xl bg-card p-6 ring-1 ring-black/5"
          >
            <div>
              <h2 className="text-sm font-semibold">Sua identidade</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Vale para o menu, a tela de entrada, os relatórios e as páginas que o avaliado abre.
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-4 ring-1 ring-black/5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Prévia</p>
              <div className="mt-2"><BrandMark brand={previewBrand} size={28} /></div>
            </div>

            <div className="space-y-2">
              <Label>Nome da plataforma</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={MARCA_PADRAO} disabled={isLoading} />
              <p className="text-[11px] text-muted-foreground">Em branco, usamos “{MARCA_PADRAO}”.</p>
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex flex-wrap items-center gap-3">
                {logoUrl && (
                  <img src={logoPreview ?? logoUrl} alt="Logo" className="h-10 max-w-40 rounded object-contain ring-1 ring-black/5" />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept={CAMPOS.logo_marca.accept}
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarLogo(f); }}
                />
                <Button type="button" variant="outline" disabled={enviando || isLoading} onClick={() => fileRef.current?.click()}>
                  {enviando ? <><Loader2 className="size-4 animate-spin" /> Enviando…</> : <><ImageUp className="size-4" /> {logoUrl ? "Trocar imagem" : "Escolher imagem"}</>}
                </Button>
                {logoUrl && (
                  <Button type="button" variant="ghost" onClick={() => { setLogoUrl(""); setLogoPreview(null); saveConta.mutate({ logo_url: null }); }}>
                    <Trash2 className="size-4" /> Remover
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{avisoDoCampo("logo_marca")} Fundo transparente fica melhor.</p>
            </div>

            <div className="space-y-2">
              <Label>Ícone do app</Label>
              <div className="flex flex-wrap items-center gap-3">
                {iconUrl && (
                  <img
                    src={iconPreview ?? iconUrl} alt="Ícone do app"
                    className="size-10 rounded-lg object-cover ring-1 ring-black/5"
                  />
                )}
                <input
                  ref={iconFileRef}
                  type="file"
                  accept={CAMPOS.icone_marca.accept}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setParaRecortarIcone(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" disabled={enviandoIcone || isLoading} onClick={() => iconFileRef.current?.click()}>
                  {enviandoIcone ? <><Loader2 className="size-4 animate-spin" /> Enviando…</> : <><ImageUp className="size-4" /> {iconUrl ? "Trocar ícone" : "Escolher ícone"}</>}
                </Button>
                {iconUrl && (
                  <Button type="button" variant="ghost" onClick={() => { setIconUrl(""); setIconPreview(null); saveConta.mutate({ icon_url: null }); }}>
                    <Trash2 className="size-4" /> Remover
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {avisoDoCampo("icone_marca")} Diferente da logo: precisa ser quadrado e continuar legível
                bem pequeno. É o que aparece na aba do navegador e na tela do celular de quem instalar a
                plataforma como aplicativo.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Imagem da tela de entrada</Label>
              <div className="flex flex-wrap items-center gap-3">
                {loginImagemUrl && (
                  <img
                    src={loginImagemPreview ?? loginImagemUrl} alt="Imagem da tela de entrada"
                    className="h-16 w-12 rounded object-cover ring-1 ring-black/5"
                  />
                )}
                <input
                  ref={loginImagemFileRef}
                  type="file"
                  accept={CAMPOS.imagem_login.accept}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setParaRecortarLoginImagem(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" disabled={enviandoLoginImagem || isLoading} onClick={() => loginImagemFileRef.current?.click()}>
                  {enviandoLoginImagem ? <><Loader2 className="size-4 animate-spin" /> Enviando…</> : <><ImageUp className="size-4" /> {loginImagemUrl ? "Trocar imagem" : "Escolher imagem"}</>}
                </Button>
                {loginImagemUrl && (
                  <Button type="button" variant="ghost" onClick={() => { setLoginImagemUrl(""); setLoginImagemPreview(null); saveConta.mutate({ login_imagem_url: null }); }}>
                    <Trash2 className="size-4" /> Remover
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {avisoDoCampo("imagem_login")} O painel ao lado do formulário de entrada. Sem imagem, fica
                sólido na cor principal.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Frase da tela de entrada</Label>
                <Textarea value={loginFrase} onChange={(e) => setLoginFrase(e.target.value)} rows={2} placeholder='"Ferramentas de assessment que revelam..."' />
              </div>
              <div className="space-y-2">
                <Label>Linha pequena embaixo</Label>
                <Input value={loginRodape} onChange={(e) => setLoginRodape(e.target.value)} placeholder="Analytical Workspace" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Aparecem por cima da imagem, no canto inferior da tela de entrada. Em branco, a linha some — sem espaço vazio.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cor principal</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="size-10 shrink-0 rounded-md border border-black/10 bg-transparent" />
                  <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
                </div>
                <p className="text-[11px] text-muted-foreground">Botões e destaques.</p>
              </div>
              <div className="space-y-2">
                <Label>Cor de apoio</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="size-10 shrink-0 rounded-md border border-black/10 bg-transparent" />
                  <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                </div>
                <p className="text-[11px] text-muted-foreground">Links e detalhes.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Seu site</Label>
                <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://seusite.com.br" />
              </div>
              <div className="space-y-2">
                <Label>Email de contato</Label>
                <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="contato@seusite.com.br" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Site e email aparecem no rodapé do relatório, para o avaliado saber a quem recorrer.
            </p>

            <Button type="submit" disabled={saveConta.isPending || isLoading}>
              {saveConta.isPending ? "Salvando…" : "Aplicar marca"}
            </Button>
          </form>
        </TabsContent>

        {/* ---------------- Relatório ---------------- */}
        <TabsContent value="relatorio" className="mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveConta.mutate({
                report_allow_pdf: allowPdf,
                report_show_brand: showBrand,
                report_hidden_blocks: hidden,
              });
            }}
            className="max-w-2xl space-y-6 rounded-xl bg-card p-6 ring-1 ring-black/5"
          >
            <div>
              <h2 className="text-sm font-semibold">O que o avaliado vê</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Vale para todos os relatórios que você enviar. Um bloco desligado some do relatório —
                nada é apagado, então dá para religar quando quiser.
              </p>
            </div>

            <div className="space-y-3">
              {REPORT_BLOCKS.map((b) => {
                const off = hidden.includes(b);
                return (
                  <label key={b} className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/5 p-3 hover:bg-muted/40">
                    <Checkbox
                      checked={!off}
                      onCheckedChange={() =>
                        setHidden((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))
                      }
                    />
                    <div>
                      <p className="text-sm font-medium">{BLOCOS[b].titulo}</p>
                      <p className="text-xs text-muted-foreground">{BLOCOS[b].ajuda}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="space-y-3 border-t border-black/5 pt-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Permitir baixar em PDF</p>
                  <p className="text-xs text-muted-foreground">Desligado, o avaliado só lê na tela — o botão de baixar some.</p>
                </div>
                <Switch checked={allowPdf} onCheckedChange={setAllowPdf} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Mostrar minha marca no relatório</p>
                  <p className="text-xs text-muted-foreground">Seu logo e sua cor na capa e no rodapé.</p>
                </div>
                <Switch checked={showBrand} onCheckedChange={setShowBrand} />
              </div>
            </div>

            <Button type="submit" disabled={saveConta.isPending || isLoading}>
              {saveConta.isPending ? "Salvando…" : "Salvar preferências"}
            </Button>
          </form>
        </TabsContent>

        {/* ---------------- Mensagens ---------------- */}
        <TabsContent value="mensagens" className="mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveConta.mutate({
                invite_message: inviteMsg.trim() || null,
                reminder_message: reminderMsg.trim() || null,
                result_message: resultMsg.trim() || null,
              });
            }}
            className="max-w-2xl space-y-6 rounded-xl bg-card p-6 ring-1 ring-black/5"
          >
            <div>
              <h2 className="text-sm font-semibold">Textos prontos</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Escreva uma vez e reaproveite em todo envio. Onde você escrever{" "}
                <code className="rounded bg-muted px-1">{"{nome}"}</code> entra o nome da pessoa, e{" "}
                <code className="rounded bg-muted px-1">{"{link}"}</code> vira o link dela.
              </p>
            </div>

            <CampoMensagem
              label="Convite" valor={inviteMsg} setValor={setInviteMsg} exemplo={EXEMPLO_CONVITE}
              ajuda="Enviado junto com o link do teste."
            />
            <CampoMensagem
              label="Lembrete" valor={reminderMsg} setValor={setReminderMsg} exemplo={EXEMPLO_LEMBRETE}
              ajuda="Para cobrar quem ainda não respondeu."
            />
            <CampoMensagem
              label="Resultado pronto" valor={resultMsg} setValor={setResultMsg} exemplo={EXEMPLO_RESULTADO}
              ajuda="Enviado junto com o link do relatório."
            />

            <Button type="submit" disabled={saveConta.isPending || isLoading}>
              {saveConta.isPending ? "Salvando…" : "Salvar mensagens"}
            </Button>
          </form>
        </TabsContent>

        {/* ---------------- Emails ---------------- */}
        <TabsContent value="agenda" className="mt-6">
          <GoogleCalendar />
        </TabsContent>

        <TabsContent value="emails" className="mt-6">
          <AbaEmails />
        </TabsContent>
          </>
        )}

      </Tabs>

      <RecortarImagem
        arquivo={paraRecortarIcone}
        aspecto={1}
        ladoMaior={1024}
        onCancelar={() => setParaRecortarIcone(null)}
        onConcluir={(recortado) => { setParaRecortarIcone(null); enviarIcone(recortado); }}
      />

      <RecortarImagem
        arquivo={paraRecortarLoginImagem}
        aspecto={3 / 4}
        ladoMaior={1600}
        onCancelar={() => setParaRecortarLoginImagem(null)}
        onConcluir={(recortado) => { setParaRecortarLoginImagem(null); enviarLoginImagem(recortado); }}
      />
    </div>
  );
}

function CampoMensagem({
  label, valor, setValor, exemplo, ajuda,
}: { label: string; valor: string; setValor: (v: string) => void; exemplo: string; ajuda: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {!valor.trim() && (
          <button type="button" onClick={() => setValor(exemplo)} className="text-xs font-medium text-accent hover:underline">
            usar um exemplo
          </button>
        )}
      </div>
      <Textarea value={valor} onChange={(e) => setValor(e.target.value)} rows={3} placeholder={exemplo} />
      <p className="text-[11px] text-muted-foreground">{ajuda}</p>
    </div>
  );
}

/** Estado da ligação com o serviço de email + histórico do que saiu. */
function AbaEmails() {
  const perfilFn = useServerFn(getMyProfile);
  const salvarFn = useServerFn(upsertConfiguracoesConta);
  const { data: perfil } = useQuery({ queryKey: ["my-profile"], queryFn: () => perfilFn() });
  const [remetente, setRemetente] = useState("");
  useEffect(() => { setRemetente(perfil?.profile?.email_from ?? ""); }, [perfil]);

  const statusFn = useServerFn(getEmailStatus);
  const logsFn = useServerFn(listEmailLogs);
  const testFn = useServerFn(sendTestEmail);
  const { data: status, isLoading } = useQuery({ queryKey: ["email-status"], queryFn: () => statusFn() });
  const { data: logs = [] } = useQuery({
    queryKey: ["email-logs"],
    queryFn: () => logsFn({ data: { limit: 30 } }),
    enabled: status?.ativo === true,
  });
  const qc = useQueryClient();

  const salvarRemetente = useMutation({
    mutationFn: () => salvarFn({ data: { email_from: remetente.trim() || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["email-status"] });
      toast.success("Remetente salvo");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const testar = useMutation({
    mutationFn: () => testFn({ data: { origin: window.location.origin } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["email-logs"] });
      toast.success(`Email de teste enviado para ${(r as { para: string }).para}`);
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Verificando…</p>;

  if (!status?.ativo) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Falta só a chave para ligar o envio de email.</p>
            <p className="text-amber-800">
              Tudo já está construído — os textos, os botões e o registro de envios. O que falta é criar a conta
              no <span className="font-medium">Resend</span> (grátis, 3.000 emails por mês), gerar uma chave e
              cadastrá-la no projeto com o nome <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code>.
            </p>
            <p className="text-amber-800">
              Assim que a chave existir, esta tela vira o painel de envios — sem precisar mexer em mais nada.
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
          <h2 className="text-sm font-semibold">Enquanto isso</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Os textos da aba <span className="font-medium">Mensagens</span> já funcionam: ao criar um envio, sai
            pronto com o nome e o link preenchidos, para colar no WhatsApp ou no seu email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Envio de email ligado.</p>
            <p className="text-emerald-800">Sai de: {status.remetente}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => testar.mutate()} disabled={testar.isPending}>
          <Send className="size-4" /> {testar.isPending ? "Enviando…" : "Enviar teste para mim"}
        </Button>
      </div>

      {status.remetente_de_teste && (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <p>
            O remetente ainda é o endereço de teste do Resend, que <span className="font-medium">só entrega
            para o email dono da conta</span>. Para enviar aos avaliados, verifique um domínio no Resend e
            cadastre o endereço em <code className="rounded bg-amber-100 px-1">EMAIL_FROM</code>.
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); salvarRemetente.mutate(); }}
        className="space-y-2 rounded-xl bg-card p-5 ring-1 ring-black/5"
      >
        <Label>Remetente</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-64 flex-1"
            value={remetente}
            onChange={(e) => setRemetente(e.target.value)}
            placeholder="Métrica Humana <contato@seudominio.com.br>"
            maxLength={200}
          />
          <Button type="submit" variant="outline" disabled={salvarRemetente.isPending}>
            {salvarRemetente.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Precisa ser um endereço de um domínio verificado no Resend. Aceita só o email
          (<code className="rounded bg-muted px-1">contato@seudominio.com.br</code>) ou com nome na frente.
          Em branco, usamos o remetente de teste.
        </p>
      </form>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
        <div className="border-b border-black/5 px-5 py-3">
          <h2 className="text-sm font-semibold">Últimos envios</h2>
        </div>
        {logs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum email enviado ainda.</p>
        ) : (
          <ul className="divide-y divide-black/5 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <span className="font-medium capitalize">{l.kind}</span>
                  <span className="text-muted-foreground"> · {l.to_email}</span>
                  {l.error && <p className="text-xs text-destructive">{l.error}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={l.status === "enviado" ? "text-emerald-700" : "text-destructive"}>
                    {l.status === "enviado" ? "entregue ao provedor" : "falhou"}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Conectar o Google Calendar.
 *
 * Mão única: o que é marcado na plataforma aparece no Google. Nada volta — foi
 * a decisão do Matheus, e é a que evita conflito de "editou nos dois lados".
 *
 * A tela nunca vê o token. Pergunta só se está conectado e com qual e-mail.
 */
function GoogleCalendar() {
  const qc = useQueryClient();
  const estadoFn = useServerFn(estadoDoGoogle);
  const conectarFn = useServerFn(iniciarConexaoGoogle);
  const desconectarFn = useServerFn(desconectarGoogle);

  const { data, isLoading } = useQuery({ queryKey: ["google"], queryFn: () => estadoFn() });

  const conectar = useMutation({
    mutationFn: () => conectarFn(),
    // Sai da plataforma para a tela do Google e volta pelo callback.
    onSuccess: (r) => { window.location.href = r.url; },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const desconectar = useMutation({
    mutationFn: () => desconectarFn(),
    onSuccess: () => {
      toast.success("Google Calendar desconectado.");
      qc.invalidateQueries({ queryKey: ["google"] });
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="max-w-2xl space-y-4 rounded-xl bg-card p-6 ring-1 ring-black/5">
      <div>
        <h2 className="text-base font-medium">Google Calendar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          As mentorias e os eventos que você marcar aqui aparecem numa agenda chamada
          <strong> Métrica Humana</strong> no seu Google. O que você mexer lá não volta para cá.
        </p>
      </div>

      {!data?.configurado ? (
        <div className="rounded-lg bg-amber-500/10 p-4 text-sm">
          A conexão com o Google ainda não foi configurada nesta plataforma. Falta cadastrar
          <code className="mx-1 rounded bg-black/10 px-1">GOOGLE_CLIENT_ID</code> e
          <code className="mx-1 rounded bg-black/10 px-1">GOOGLE_CLIENT_SECRET</code>.
        </div>
      ) : data.conectado ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-500/10 p-4">
            <p className="text-sm">
              Conectado{data.email ? ` como ${data.email}` : ""}.
              {data.ultimo_uso_em && !data.ultimo_erro && (
                <span className="text-muted-foreground">
                  {" "}Última sincronia em{" "}
                  {new Date(data.ultimo_uso_em).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}.
                </span>
              )}
            </p>
            <Button variant="outline" size="sm" onClick={() => desconectar.mutate()}
                    disabled={desconectar.isPending}>
              Desconectar
            </Button>
          </div>

          {/* A última falha. Ela já era gravada e nenhuma tela lia: o mentor
              marcava a mentoria, a tela dizia "salvo", e o compromisso não
              chegava ao Google. Ele descobria no dia, quando o cliente não
              entrava na chamada. Desde a 4b este mesmo campo também guarda
              falha da consulta de bloqueio pela agenda pessoal — por isso o
              texto fala em "falar com o Google", não só em "sincronizar". */}
          {data.ultimo_erro && (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">
                A última tentativa de falar com o Google falhou.
              </p>
              <p className="mt-1 text-muted-foreground">
                Pode ser um compromisso que não chegou à sua agenda do Google, ou o bloqueio pela
                agenda pessoal (nos links de auto-agendamento) que não considerou seus horários
                ocupados. O motivo relatado pelo Google foi:
              </p>
              <code className="mt-2 block overflow-x-auto rounded bg-black/10 p-2 text-xs">
                {data.ultimo_erro}
              </code>
              <p className="mt-2 text-muted-foreground">
                Normalmente é acesso revogado ou permissão retirada. Desconecte e conecte de novo —
                a próxima ação que depender do Google refaz a partir daí.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <Button onClick={() => conectar.mutate()} disabled={conectar.isPending}>
            {conectar.isPending ? "Abrindo o Google…" : "Conectar meu Google Calendar"}
          </Button>
          <p className="text-xs text-muted-foreground">
            A plataforma cria uma agenda própria e só mexe nos eventos dela. Não lê, não edita e
            não apaga nada do seu calendário pessoal.
          </p>
        </div>
      )}
    </div>
  );
}
