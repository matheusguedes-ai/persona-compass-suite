import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CurrentUserProvider } from "../lib/role-context";
import { SCRIPT_ANTI_PISCADA, ThemeProvider } from "@/lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Métrica Humana — Plataforma de Assessments" },
      { name: "description", content: "Gerencie, dispare e analise testes de perfil, habilidades e competências humanas (DISC, MBTI, Big Five, Temperamentos e mais)." },
      { name: "author", content: "Métrica Humana" },
      { property: "og:title", content: "Métrica Humana — Plataforma de Assessments" },
      { property: "og:description", content: "Gerencie, dispare e analise testes de perfil, habilidades e competências humanas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // Cor fixa: o head daqui é estático (não sabe de qual conta é o
      // pedido), diferente do manifest e do ícone abaixo, que resolvem a
      // conta no SERVIDOR a cada chamada. Deixar esta tag dinâmica exigiria
      // um loader assíncrono na rota raiz — para o tom da barra do
      // navegador, não vale o risco de mexer no que toda página usa.
      { name: "theme-color", content: "#164e63" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
      },
      // O caminho é fixo; quem decide SE mostra o ícone da conta ou o
      // favicon padrão é a rota /api/icone/$tamanho, no servidor — ver o
      // comentário lá. Assim a aba do navegador já usa a marca da conta sem
      // precisar tornar este head() dinâmico.
      { rel: "icon", href: "/api/icone/192", type: "image/jpeg" },
      { rel: "apple-touch-icon", href: "/api/icone/apple" },
      { rel: "manifest", href: "/api/manifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Antes do React subir, para a tela não piscar no tema errado. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ANTI_PISCADA }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <CurrentUserProvider>
        <ThemeProvider>
          <Outlet />
        </ThemeProvider>
      </CurrentUserProvider>
    </QueryClientProvider>
  );
}
