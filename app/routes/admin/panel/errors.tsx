import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { Section } from "@/components/Section";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { recentErrors, sentryLink } from "@/features/admin/errors/server/queries.server";
import { ErrorList } from "@/features/admin/errors/ui/ErrorList";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { formatNumber } from "@/lib/format";

export const meta = () => [{ title: "Erros · Nelcota" }];

export const loader = routeLoader(async () => {
  await requireAdmin({ audit: ["read"] });
  const { latest, lastDay } = await recentErrors(getDb());
  const issuesUrl = getEnv().SENTRY_ISSUES_URL;
  return {
    lastDay,
    errors: latest.map((error) => ({
      ...error,
      sentryUrl: sentryLink(issuesUrl, error.requestId),
    })),
    sentryConfigured: Boolean(issuesUrl),
  };
});

export default function AdminErrorsPage() {
  const { lastDay, errors, sentryConfigured } = useLoaderData<typeof loader>();
  const count = lastDay === 1 ? "1 erro" : `${formatNumber(lastDay)} erros`;
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Erros</h1>
        <p className="mt-1 text-ink-muted">{count} nas últimas 24 h.</p>
      </div>
      <Section
        title="Recentes"
        description={
          sentryConfigured ? undefined : "Defina SENTRY_ISSUES_URL para ligar ao Sentry."
        }
      >
        <ErrorList errors={errors} />
      </Section>
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
