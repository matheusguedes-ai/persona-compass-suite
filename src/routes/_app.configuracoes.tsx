import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, upsertMyProfile } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Métrica Humana" },
      { name: "description", content: "Configure sua conta, equipe, marca (White Label) e modelos de email." },
      { property: "og:title", content: "Configurações — Métrica Humana" },
      { property: "og:description", content: "Personalize a plataforma e ajuste suas preferências." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyProfile);
  const saveFn = useServerFn(upsertMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => getFn() });

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [brandColor, setBrandColor] = useState("#164e63");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    if (!data) return;
    setFullName(data.profile?.full_name ?? "");
    setCompanyName(data.profile?.company_name ?? "");
    setBrandColor(data.profile?.brand_color ?? "#164e63");
    setLogoUrl(data.profile?.logo_url ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: (v: { full_name?: string | null; company_name?: string | null; brand_color?: string | null; logo_url?: string | null }) => saveFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-profile"] }); toast.success("Alterações salvas"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize a plataforma, sua equipe e a identidade da marca.
        </p>
      </div>

      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">Perfil da conta</TabsTrigger>
          <TabsTrigger value="marca">Marca (White Label)</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="emails">Modelos de email</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-6">
          <form
            onSubmit={(e) => { e.preventDefault(); save.mutate({ full_name: fullName.trim() || null }); }}
            className="max-w-xl space-y-4 rounded-xl bg-card p-6 ring-1 ring-black/5"
          >
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

        <TabsContent value="marca" className="mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({
                company_name: companyName.trim() || null,
                brand_color: brandColor || null,
                logo_url: logoUrl.trim() || null,
              });
            }}
            className="max-w-xl space-y-6 rounded-xl bg-card p-6 ring-1 ring-black/5"
          >
            <div>
              <h2 className="text-sm font-semibold">Identidade White Label</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Personalize nome, logo e cores para publicar a plataforma com a sua marca.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome da plataforma</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Métrica Humana" disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label>URL do logo</Label>
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://cdn.exemplo.com/logo.png" disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label>Cor primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="size-10 rounded-md border border-black/10 bg-transparent"
                />
                <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={save.isPending || isLoading}>
              {save.isPending ? "Salvando…" : "Aplicar marca"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="equipe" className="mt-6">
          <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
            <h2 className="text-base font-medium">Gestão da equipe</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Convide administradores e coaches. Esta área será conectada ao módulo de Mentores.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="emails" className="mt-6">
          <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
            <h2 className="text-base font-medium">Modelos de email</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Personalize os emails de convite, lembrete e conclusão dos testes.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}