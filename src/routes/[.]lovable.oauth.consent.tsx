import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Local typed wrapper for the beta `supabase.auth.oauth` namespace.
type AuthorizationDetails = {
  client?: { name?: string; client_id?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scopes?: string[] | null;
  requested_scopes?: string[] | null;
};
type OAuthResult<T> = { data: T | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails(id: string): Promise<OAuthResult<AuthorizationDetails>>;
  approveAuthorization(id: string): Promise<OAuthResult<AuthorizationDetails>>;
  denyAuthorization(id: string): Promise<OAuthResult<AuthorizationDetails>>;
};
function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id:
      typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) {
      throw new Error("Missing authorization_id");
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const params = new URLSearchParams(location.search);
    const authorizationId = params.get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(
      authorizationId,
    );
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      throw redirect({ href: immediate });
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">Não foi possível carregar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "um aplicativo";
  const scopes = details?.requested_scopes ?? details?.scopes ?? [];

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Nenhum redirecionamento retornado pelo servidor de autorização.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main
      className="mx-auto max-w-md p-8"
      style={{ fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="mb-6 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span className="grid size-6 place-items-center rounded bg-accent text-accent-foreground">
          M
        </span>
        Métrica Humana
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Conectar {clientName} à sua conta
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Isto permite que {clientName} use esta plataforma agindo como você,
        respeitando suas permissões.
      </p>

      {scopes.length > 0 && (
        <div className="mt-6 rounded-md border border-border p-4 text-sm">
          <p className="mb-2 font-medium">Permissões solicitadas</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {scopes.map((s: string) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Isto não substitui as permissões e políticas de acesso da plataforma.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <Button
          disabled={busy}
          onClick={() => decide(true)}
          className="flex-1"
        >
          Aprovar
        </Button>
        <Button
          disabled={busy}
          onClick={() => decide(false)}
          variant="outline"
          className="flex-1"
        >
          Recusar
        </Button>
      </div>
    </main>
  );
}