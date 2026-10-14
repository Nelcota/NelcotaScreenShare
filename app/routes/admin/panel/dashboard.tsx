import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData, Link } from "react-router";

import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { getDashboardSummary } from "@/features/admin/dashboard/server/summary.server";
import { getDb } from "@/server/db/index.server";
import { AdminPageHeader } from "@/features/admin/shell/ui/AdminPageHeader";

export const meta = () => [{ title: "Início · Nelcota" }];

export const loader = routeLoader(async () => {
  await requireAdmin({ dashboard: ["read"] });
  return { summary: await getDashboardSummary(getDb()) };
});

const STAT = "panel flex h-full flex-col gap-1 rounded-2xl p-5";

function StatBody({ value, label }: { value: number; label: string }) {
  return (
    <>
      <span className="text-3xl font-medium tracking-tight tabular-nums">{value}</span>
      <span className="text-sm text-ink-muted">{label}</span>
    </>
  );
}

/** A number that links to its list, or plain when there is no list to open. */
function Stat({ href, value, label }: { href?: string; value: number; label: string }) {
  if (!href) {
    return (
      <li className={STAT}>
        <StatBody value={value} label={label} />
      </li>
    );
  }
  return (
    <li>
      <Link viewTransition to={href} className={`${STAT} transition-colors hover:bg-surface-2`}>
        <StatBody value={value} label={label} />
      </Link>
    </li>
  );
}

export default function AdminHomePage() {
  const { summary } = useLoaderData<typeof loader>();
  return (
    <>
      <AdminPageHeader
        title="Início"
        description="O que está acontecendo agora e o que mudou nos últimos dias."
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          href="/admin/salas?status=ativa"
          value={summary.activeRooms}
          label="Salas abertas agora"
        />
        <Stat
          href="/admin/salas?status=ativa"
          value={summary.peopleOnline}
          label="Pessoas em sala agora"
        />
        <Stat
          href="/admin/compartilhamentos"
          value={summary.sharesToday}
          label="Telas compartilhadas nas últimas 24 h"
        />
        <Stat
          href="/admin/usuarios"
          value={summary.newParticipants}
          label="Contas novas nos últimos 7 dias"
        />
        <Stat
          href="/admin/lista-pro"
          value={summary.proInterests}
          label="Pessoas na lista de espera do Pro"
        />
      </ul>
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
