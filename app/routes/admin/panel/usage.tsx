import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { Section } from "@/components/Section";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { USAGE_DAYS } from "@/features/admin/usage/domain/period";
import {
  browserShares,
  dailySocial,
  dailyUsage,
} from "@/features/admin/usage/server/queries.server";
import { BrowserList } from "@/features/admin/usage/ui/BrowserList";
import { SocialTable } from "@/features/admin/usage/ui/SocialTable";
import { UsageTable } from "@/features/admin/usage/ui/UsageTable";
import { getDb } from "@/server/db/index.server";
import { formatNumber } from "@/lib/format";

export const meta = () => [{ title: "Uso diário · Nelcota" }];

export const loader = routeLoader(async () => {
  await requireAdmin({ dashboard: ["read"] });
  const db = getDb();
  const [days, social, browsers] = await Promise.all([
    dailyUsage(db),
    dailySocial(db),
    browserShares(db),
  ]);
  return { days, social, browsers };
});

function Summary({ days }: { days: { rooms: number; minutes: number }[] }) {
  const rooms = days.reduce((sum, day) => sum + day.rooms, 0);
  const hours = Math.round(days.reduce((sum, day) => sum + day.minutes, 0) / 60);
  return (
    <>
      {`Nos últimos ${USAGE_DAYS} dias: ${formatNumber(rooms)} ${rooms === 1 ? "sala" : "salas"} e ${formatNumber(hours)} ${hours === 1 ? "hora" : "horas"} em chamada.`}
    </>
  );
}

export default function AdminUsagePage() {
  const { days, social, browsers } = useLoaderData<typeof loader>();
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">Uso diário</h1>
        <p className="mt-1 text-ink-muted">
          <Summary days={days} />
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Section title="Por dia">
          <UsageTable days={days} />
        </Section>
        <Section title="Navegadores das sessões abertas">
          <BrowserList browsers={browsers} />
        </Section>
      </div>
      <Section title="Mensagens e amigos">
        <SocialTable days={social} />
      </Section>
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
