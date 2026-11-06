import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { getVisitor } from "@/lib/visitor.functions";
import { sessionVisitor, setSessionVisitor } from "@/lib/visitor-edition";
import { adsenseClientId, GOOGLE_FC_SIGNAL } from "@/lib/ads";
import { isRtl } from "@/lib/i18n";
import { useLang } from "@/lib/use-edition";
import { getPublicSite } from "../lib/site.functions";
import { SiteChrome } from "../components/SiteChrome";
import { SiteFooter } from "../components/SiteFooter";

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

function ErrorComponent({ error, reset }: ErrorComponentProps) {
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
        {/Missing Supabase environment/i.test(String((error as Error | undefined)?.message ?? "")) ? (
          <p className="mt-2 text-sm text-muted-foreground">
            The site can't find its database settings. In the project folder, create a file named <code>.env</code> (copy <code>.env.example</code>),
            fill in your Supabase URL and keys, then stop and restart <code>npm run dev</code>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong on our end. You can try refreshing or head back home.
          </p>
        )}
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
  // Which edition a visitor with no ?e= in the address should see: their last choice, else their country, else the world.
  beforeLoad: async () => {
    const known = sessionVisitor();
    if (known) return { visitorEdition: known.edition, visitorLang: known.lang, visitorConsent: known.consent };
    const v = await getVisitor();
    setSessionVisitor(v);
    return { visitorEdition: v.edition, visitorLang: v.lang, visitorConsent: v.consent };
  },
  loader: () => getPublicSite(),
  staleTime: 60_000,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Brief" },
      { name: "description", content: "What is happening in the world, from every source, in a few minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800;9..144,900&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    scripts: (() => {
      const client = loaderData?.adsense.enabled ? adsenseClientId(loaderData.adsense.client) : null;
      return client
        ? [
            { src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`, async: true, crossOrigin: "anonymous" as const },
            // Google's consent message (set up in AdSense > Privacy & messaging). It shows only where the law asks for it.
            { src: `https://fundingchoicesmessages.google.com/i/${client.replace(/^ca-/, "")}?ers=1`, async: true },
            { children: GOOGLE_FC_SIGNAL },
          ]
        : [];
    })(),
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const theme = Route.useLoaderData()?.theme ?? "default";
  // The page's language and direction, so screen readers, spell-check and fonts behave, and Arabic reads right to left.
  const lang = useLang();
  return (
    <html lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"} data-theme={theme}>
      <head>
        <HeadContent />
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
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <SiteChrome />
      <Outlet />
      <SiteFooter />
    </QueryClientProvider>
  );
}
