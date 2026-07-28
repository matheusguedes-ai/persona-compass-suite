import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, upsertMyProfile, REPORT_BLOCKS } from "@/lib/data.functions";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark, MARCA_PADRAO } from "@/lib/brand";
import { AvatarUpload } from "@/components/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  const { data, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => getFn() });

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [brandColor, setBrandColor] = useState("#164e63");
  const [accentColor, setAccentColor] = useState("#0e7490");
  const [logoUrl, setLogoUrl] = useState("");
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

  useEffect(() => {
    const p = data?.profile;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setCompanyName(p.company_name ?? "");
    setBrandColor(p.brand_color ?? "#164e63");
    setAccentColor(p.brand_accent_color ?? "#0e7490");
    setLogoUrl(p.logo_url ?? "");
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

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => saveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Alterações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * Sobe o arquivo direto para o armazenamento do Supabase, na pasta do próprio
   * usuário. O caminho leva a hora no nome para o navegador não continuar
   * mostrando o logo antigo do cache depois da troca.
   */
  async function enviarLogo(file: File) {
    const userId = data?.user_id;
    if (!userId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem precisa ter no máximo 2 MB.");
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
      if (error) throw new Error(error.message);
      const { data: pub } = supabase.storage.from("marca").getPublicUrl(caminho);
      setLogoUrl(pub.publicUrl);
      save.mutate({ logo_url: pub.publicUrl });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a imagem.");
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const previewBrand = {
    company_name: companyName || null,
    logo_url: logoUrl || null,
    brand_color: brandColor,
    brand_accent_color: accentColor,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize a plataforma, a identidade da marca e o que o avaliado vê.
        </p>
      </div>

      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">Perfil da conta</TabsTrigger>
          <TabsTrigger value="marca">Marca</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
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
                Aparece no menu e para a sua equipe. PNG, JPG ou WEBP, até 2 MB.
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

        {/* ---------------- Marca ---------------- */}
        <TabsContent value="marca" className="mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({
                company_name: companyName.trim() || null,
                brand_color: brandColor || null,
                brand_accent_color: accentColor || null,
                logo_url: logoUrl.trim() || null,
                site_url: siteUrl.trim() || null,
                support_email: supportEmail.trim() || null,
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
                  <img src={logoUrl} alt="Logo" className="h-10 max-w-40 rounded object-contain ring-1 ring-black/5" />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarLogo(f); }}
                />
                <Button type="button" variant="outline" disabled={enviando || isLoading} onClick={() => fileRef.current?.click()}>
                  {enviando ? <><Loader2 className="size-4 animate-spin" /> Enviando…</> : <><ImageUp className="size-4" /> {logoUrl ? "Trocar imagem" : "Escolher imagem"}</>}
                </Button>
                {logoUrl && (
                  <Button type="button" variant="ghost" onClick={() => { setLogoUrl(""); save.mutate({ logo_url: null }); }}>
                    <Trash2 className="size-4" /> Remover
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP ou SVG, até 2 MB. Fundo transparente fica melhor.</p>
            </div>

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

            <Button type="submit" disabled={save.isPending || isLoading}>
              {save.isPending ? "Salvando…" : "Aplicar marca"}
            </Button>
          </form>
        </TabsContent>

        {/* ---------------- Relatório ---------------- */}
        <TabsContent value="relatorio" className="mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({
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

            <Button type="submit" disabled={save.isPending || isLoading}>
              {save.isPending ? "Salvando…" : "Salvar preferências"}
            </Button>
          </form>
        </TabsContent>

        {/* ---------------- Mensagens ---------------- */}
        <TabsContent value="mensagens" className="mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({
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

            <Button type="submit" disabled={save.isPending || isLoading}>
              {save.isPending ? "Salvando…" : "Salvar mensagens"}
            </Button>
          </form>
        </TabsContent>

        {/* ---------------- Emails ---------------- */}
        <TabsContent value="emails" className="mt-6">
          <div className="max-w-2xl space-y-4">
            <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
              <AlertCircle className="mt-0.5 size-5 shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">O envio automático ainda não está ligado.</p>
                <p className="text-amber-800">
                  Para a plataforma mandar email por conta própria (convite, lembrete e relatório pronto)
                  falta contratar um serviço de envio. O <span className="font-medium">Resend</span> tem plano
                  gratuito de 3.000 emails por mês e é o mais simples de ligar. Assim que você criar a conta e
                  me passar a chave, isso aqui vira uma tela de verdade com histórico de envios.
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
              <h2 className="text-sm font-semibold">Enquanto isso</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Os textos da aba <span className="font-medium">Mensagens</span> já funcionam: na hora de criar um
                envio, o texto sai pronto com o nome e o link preenchidos, para você colar no WhatsApp ou no seu
                email. É o mesmo conteúdo que o envio automático vai usar depois.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
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
