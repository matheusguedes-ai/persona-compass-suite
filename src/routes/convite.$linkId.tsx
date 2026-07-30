import { SeloEmpresa } from "@/components/selo-empresa";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { BrandMark, useApplyBrand, type Brand } from "@/lib/brand";

export const Route = createFileRoute("/convite/$linkId")({
  head: () => ({ meta: [{ title: "Convite para responder" }, { name: "robots", content: "noindex" }] }),
  component: ConvitePage,
});

type Info = {
  id: string;
  brand?: Brand | null;
  title: string | null;
  tests: string[];
  expires_at: string | null;
  remaining: number | null;
  blocked: "not_found" | "inactive" | "expired" | "full" | null;
  message: string | null;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-xl bg-card p-8 ring-1 ring-black/5">{children}</div>
    </div>
  );
}

function ConvitePage() {
  const { linkId } = Route.useParams();
  const nav = useNavigate();
  const [info, setInfo] = useState<Info | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  useApplyBrand(info?.brand);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/public/invite/${linkId}`);
        const json = (await r.json()) as Info & { error?: string; message?: string };
        if (!alive) return;
        if (!r.ok && r.status === 404) {
          setLoadError(json.message ?? "Link não encontrado.");
          return;
        }
        setInfo(json);
      } catch {
        if (alive) setLoadError("Falha de conexão. Tente novamente.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [linkId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSubmitError(null);
    try {
      const r = await fetch(`/api/public/invite/${linkId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, phone }),
      });
      const json = (await r.json()) as { kind?: string; id?: string; message?: string; error?: string };
      if (!r.ok) {
        setSubmitError(json.message ?? json.error ?? "Não foi possível continuar.");
        setBusy(false);
        return;
      }
      if (json.kind === "assessment") nav({ to: "/bateria/$assessmentId", params: { assessmentId: json.id! } });
      else nav({ to: "/responder/$responseId", params: { responseId: json.id! } });
    } catch {
      setSubmitError("Falha de conexão. Tente novamente.");
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{loadError}</p>
        </div>
      </Shell>
    );
  }
  if (!info) return <Shell><p className="text-center text-sm text-muted-foreground">Carregando…</p></Shell>;

  if (info.blocked) {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="mx-auto size-10 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold">Link indisponível</h1>
          <p className="mt-1 text-sm text-muted-foreground">{info.message}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {info.brand && <div className="mb-5"><BrandMark brand={info.brand} size={28} /></div>}
      <h1 className="text-xl font-semibold tracking-tight">{info.title || "Convite para responder"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Preencha seus dados para começar. Leva poucos minutos e suas respostas ficam com o mentor que enviou o convite.
      </p>

      {info.tests.length > 0 && (
        <div className="mt-5 rounded-lg bg-muted/40 p-4 ring-1 ring-black/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {info.tests.length === 1 ? "Você vai responder" : `Você vai responder ${info.tests.length} inventários`}
          </p>
          <ul className="mt-2 space-y-1">
            {info.tests.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-3.5 text-muted-foreground" /> {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="nome">Nome completo</Label>
          <Input
            id="nome" required minLength={2} maxLength={160} placeholder="Como você quer ser chamado"
            value={fullName} onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email" type="email" required maxLength={160} placeholder="voce@exemplo.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone" type="tel" required minLength={8} maxLength={40} placeholder="(11) 99999-0000"
            value={phone} onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {submitError && <p className="text-sm text-destructive" role="alert">{submitError}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Preparando…" : <>Começar <ArrowRight className="size-4" /></>}
        </Button>
      </form>

      <div className="mt-4 space-y-1 text-center text-xs text-muted-foreground">
        {info.expires_at && <p>Disponível até {new Date(info.expires_at).toLocaleString("pt-BR")}</p>}
        {info.remaining != null && (
          <p>{info.remaining === 1 ? "Resta 1 vaga" : `Restam ${info.remaining} vagas`}</p>
        )}
        <SeloEmpresa nome={info?.brand?.company_seal_name} cnpj={info?.brand?.company_cnpj} className="mt-10" />
      </div>
    </Shell>
  );
}
