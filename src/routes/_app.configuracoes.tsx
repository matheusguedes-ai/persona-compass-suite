import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload } from "lucide-react";
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
            onSubmit={(e) => { e.preventDefault(); toast.success("Perfil salvo (demo)"); }}
            className="max-w-xl space-y-4 rounded-xl bg-card p-6 ring-1 ring-black/5"
          >
            <div className="space-y-2"><Label>Nome</Label><Input defaultValue="Marina Cardoso" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" defaultValue="marina@metrica.com" /></div>
            <div className="space-y-2"><Label>Fuso horário</Label><Input defaultValue="America/Sao_Paulo" /></div>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </TabsContent>

        <TabsContent value="marca" className="mt-6">
          <form
            onSubmit={(e) => { e.preventDefault(); toast.success("Marca atualizada (demo)"); }}
            className="max-w-xl space-y-6 rounded-xl bg-card p-6 ring-1 ring-black/5"
          >
            <div>
              <h2 className="text-sm font-semibold">Identidade White Label</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Personalize nome, logo e cores para publicar a plataforma com a sua marca.
              </p>
            </div>
            <div className="space-y-2"><Label>Nome da plataforma</Label><Input defaultValue="Métrica Humana" /></div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <div className="grid size-14 place-items-center rounded-md bg-muted ring-1 ring-black/5">
                  <Upload className="size-4 text-muted-foreground" />
                </div>
                <Button type="button" variant="outline" onClick={() => toast.info("Upload de logo (demo)")}>Enviar arquivo</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor primária</Label>
                <div className="flex items-center gap-2">
                  <input type="color" defaultValue="#164e63" className="size-10 rounded-md border border-black/10 bg-transparent" />
                  <Input defaultValue="#164e63" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor de acento</Label>
                <div className="flex items-center gap-2">
                  <input type="color" defaultValue="#0d9488" className="size-10 rounded-md border border-black/10 bg-transparent" />
                  <Input defaultValue="#0d9488" />
                </div>
              </div>
            </div>
            <div className="space-y-2"><Label>Domínio personalizado</Label><Input placeholder="assessments.suamarca.com" /></div>
            <Button type="submit">Aplicar marca</Button>
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