import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { requireAdmin } from "@/features/auth/server/admin-session.server";
import {
  checkDatabase,
  checkLiveKit,
  checkMailConfiguration,
  deployInfo,
  lastMailDelivery,
} from "@/features/admin/status/server/checks.server";
import { mailHealth } from "@/features/admin/status/domain/mail-health";
import { getLiveKitEventsSummary } from "@/features/admin/status/server/livekit-events.server";
import { HealthCard } from "@/features/admin/status/ui/HealthCard";
import { LiveKitEvents } from "@/features/admin/status/ui/LiveKitEvents";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { formatDateTime, formatRelative } from "@/lib/format";
import { AdminPageHeader } from "@/features/admin/shell/ui/AdminPageHeader";

export const meta = () => [{ title: "Status · Nelcota" }];

export const loader = routeLoader(async () => {
  await requireAdmin({ system: ["status"] });
  const db = getDb();
  const [database, liveKit] = await Promise.all([checkDatabase(db), checkLiveKit()]);
  // Without the database there are no events to read: the card already says why.
  const [events, lastDelivery] =
    database.state === "down"
      ? [null, null]
      : await Promise.all([getLiveKitEventsSummary(db), lastMailDelivery(db)]);
  return {
    database,
    liveKit,
    mail: mailHealth(checkMailConfiguration(), lastDelivery),
    deploy: deployInfo(getEnv().APP_VERSION),
    events,
  };
});

function Version({ deploy }: { deploy: ReturnType<typeof deployInfo> }) {
  const version = deploy.version?.slice(0, 7) ?? "Versão de desenvolvimento";
  return (
    <>
      <p>
        {deploy.commitUrl ? (
          <a
            href={deploy.commitUrl}
            target="_blank"
            rel="noreferrer"
            className="font-sans text-ink tabular-nums hover:underline"
          >
            {version}
          </a>
        ) : (
          version
        )}
      </p>
      <p title={formatDateTime(deploy.startedAt)}>Iniciada {formatRelative(deploy.startedAt)}</p>
    </>
  );
}

export default function AdminStatusPage() {
  const { database, liveKit, mail, deploy, events } = useLoaderData<typeof loader>();
  return (
    <>
      <AdminPageHeader title="Status" description="Banco, chamadas e e-mail agora." />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard title="Banco de dados" state={database.state}>
          {database.detail}
        </HealthCard>
        <HealthCard title="LiveKit" state={liveKit.state}>
          {liveKit.detail}
        </HealthCard>
        <HealthCard title="E-mail" state={mail.state}>
          {mail.detail}
        </HealthCard>
        <HealthCard title="Versão no ar">
          <Version deploy={deploy} />
        </HealthCard>
      </ul>
      {events ? <LiveKitEvents summary={events} /> : null}
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
