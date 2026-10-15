import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useMatches,
  useRouteLoaderData,
  useRevalidator,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type LinksFunction,
} from "react-router";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { InlineScript } from "@/components/InlineScript";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSetting, mascotSettings } from "@/features/admin/settings/server/settings.server";
import { withRequest } from "@/server/request-context.server";
import { THEME_COLOR, THEME_INIT_SCRIPT } from "@/lib/theme";
import { useNavigationRecovery } from "@/lib/navigation-recovery";
import { useOfflineNotice } from "@/lib/hooks/use-offline-notice";
import { requestMiddleware } from "@/server/middleware.server";
import { getUserSession } from "@/features/auth/server/participant-session.server";
import { pendingReceivedCount } from "@/features/friends/server/friend-list.server";
import { ringingState } from "@/features/ringing/server/ringing-state.server";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { publicOrigin } from "@/server/seo.server";
import { isIndexable } from "@/lib/seo";
import { configureBrowserTelemetry } from "@/lib/telemetry.client";
import { ErrorScreen } from "@/components/shell/ErrorScreen";
import { Mascot } from "@/features/mascot/ui/Mascot";
import { NavigationProgress } from "@/components/shell/NavigationProgress";
import { usePresenceBeat } from "@/features/friends/client/use-presence-beat";
import { useLiveUpdates } from "@/features/live/client/use-live-updates";
import { ActiveRoom } from "@/features/room/ui/ActiveRoom";
import { RoomColumn } from "./routes/app/room-column";
import type { loader as roomLoader } from "./routes/room";
import "./fonts.css";
import manrope from "@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url";
import "./globals.css";
import { NotificationsRuntime } from "@/features/notifications/ui/NotificationsRuntime";
import { RingRuntime } from "@/features/ringing/ui/RingRuntime";

export const middleware = [requestMiddleware];
export const links: LinksFunction = () => [
  { rel: "preload", href: manrope, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
];
export const meta = () => [
  { title: "Nelcota · Compartilhamento de tela" },
  {
    name: "description",
    content: "Compartilhamento de tela no navegador para times de tecnologia.",
  },
];

export const loader = ({ request, context }: LoaderFunctionArgs) =>
  withRequest(request, context, async () => {
    const [mascot, current] = await Promise.all([getSetting(mascotSettings), getUserSession()]);
    const friendRequests = current ? await pendingReceivedCount(getDb(), current.user.id) : 0;
    const ringing = current ? await ringingState(getDb(), current.user.id) : null;
    return {
      nonce: request.headers.get("x-nonce") ?? undefined,
      origin: publicOrigin(request),
      mascot,
      account: current
        ? { name: current.user.name, image: current.user.image, friendRequests }
        : null,
      telemetry: { dsn: getEnv().PUBLIC_SENTRY_DSN, release: getEnv().APP_VERSION },
      ringing,
    };
  });

export function Layout({ children }: { children: ReactNode }) {
  const data = useLoaderData<typeof loader>();
  const [nonce] = useState(data?.nonce);
  // Only pages marked as indexable (see lib/seo.ts) may show up in search results.
  const indexable = useMatches().some((match) => isIndexable(match.handle));
  useEffect(() => {
    configureBrowserTelemetry(data?.telemetry);
  }, [data?.telemetry]);
  const style: CSSProperties & Record<`--${string}`, number | string> = {
    "--font-manrope": "'Manrope Variable', sans-serif",
    "--mascot-saturation-dark": data?.mascot.saturationDark ?? 1,
    "--mascot-saturation-light": data?.mascot.saturationLight ?? 1,
  };
  return (
    <html lang="pt-BR" style={style} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {indexable ? null : <meta name="robots" content="noindex, nofollow" />}
        <meta name="theme-color" content={THEME_COLOR.dark} />
        <meta name="color-scheme" content="dark light" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" sizes="192x192" />
        <Meta />
        <Links nonce={nonce} />
        <InlineScript nonce={nonce} html={THEME_INIT_SCRIPT} />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <NuqsAdapter>
          <TooltipProvider delayDuration={300}>
            <NavigationProgress />
            {children}
          </TooltipProvider>
        </NuqsAdapter>
        {/* Expanded and capped at 3 so notices never overlap. The top offset keeps them below
            the top bar; the bottom one (used by the room notices at the bottom right) keeps
            them above the call's control dock. */}
        <Toaster
          position="top-center"
          expand
          visibleToasts={3}
          offset={{ top: "5rem", bottom: "8.5rem" }}
          mobileOffset={{ top: "5rem", bottom: "7.5rem" }}
        />
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  const revalidator = useRevalidator();
  const signedIn = Boolean(useLoaderData<typeof loader>()?.account);
  usePresenceBeat(signedIn);
  useLiveUpdates(signedIn);
  useNavigationRecovery();
  useOfflineNotice();
  useEffect(() => {
    const revalidate = () => {
      void revalidator.revalidate();
    };
    window.addEventListener("nelcota:mutation", revalidate);
    return () => window.removeEventListener("nelcota:mutation", revalidate);
  }, [revalidator]);
  // The room page draws nothing: the call is here, so it survives navigation.
  const room = useRouteLoaderData<typeof roomLoader>("room");
  return (
    <>
      <Outlet />
      <ActiveRoom
        room={room}
        renderColumn={
          room?.column
            ? (inCall) => room.column && <RoomColumn column={room.column} inCall={inCall} />
            : undefined
        }
      />
      <NotificationsRuntime />
      <RingRuntime />
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  return (
    <ErrorScreen
      missing={missing}
      mascot={
        <Mascot
          className="size-32"
          sizes="384px"
          expression={missing ? "worried" : "surprised"}
          canSleep={false}
        />
      }
    />
  );
}
