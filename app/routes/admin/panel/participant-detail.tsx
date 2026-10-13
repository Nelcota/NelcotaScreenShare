import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData, Link } from "react-router";

import { ArrowLeft } from "lucide-react";
import { notFound } from "@/server/http.server";
import { z } from "zod";
import { StatusBadge } from "@/components/StatusBadge";
import { ParticipantActions } from "@/features/admin/participants/ui/ParticipantActions";
import { STATUS_LABELS } from "@/features/admin/participants/domain/labels";
import {
  ParticipantAccount,
  ParticipantSessions,
  ParticipantTimeline,
} from "@/features/admin/participants/ui/ParticipantDetailSections";
import { AdminHistory } from "@/features/admin/audit/ui/AdminHistory";
import { getParticipantDetail } from "@/features/admin/participants/server/queries.server";
import { socialCounts } from "@/features/admin/participants/server/social-counts.server";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { getDb } from "@/server/db/index.server";

export const meta = () => [{ title: "Participante · Nelcota" }];

export const loader = routeLoader(async ({ params }) => {
  const admin = await requireAdmin({ participant: ["read"] });
  const id = params.id ?? "";
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const detail = await getParticipantDetail(db, id);
  if (!detail) notFound();
  const { account, sessions, timeline, history } = detail;
  const social = await socialCounts(db, id);
  const role = admin.user.role;
  const status = STATUS_LABELS[account.status];

  return {
    account,
    sessions,
    timeline,
    history,
    social,
    status,
    permissions: {
      update: can(role, { participant: ["update"] }),
      delete: can(role, { participant: ["delete"] }),
      anonymize: can(role, { participant: ["anonymize"] }),
      disableTwoFactor: can(role, { participant: ["disableTwoFactor"] }),
    },
  };
});

export default function ParticipantPage() {
  const { account, sessions, timeline, history, social, status, permissions } =
    useLoaderData<typeof loader>();
  return (
    <>
      <div className="flex flex-col gap-3">
        <Link
          viewTransition
          to="/admin/usuarios"
          className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Participantes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">{account.name}</h1>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <p className="text-ink-muted">{account.email}</p>
        <ParticipantActions
          id={account.id}
          status={account.status}
          verified={account.emailVerified}
          anonymized={account.anonymizedAt !== null}
          twoFactor={account.twoFactorEnabled}
          photo={account.hasPhoto}
          sessions={sessions.length}
          can={permissions}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ParticipantAccount account={account} social={social} />
        <ParticipantSessions sessions={sessions} />
      </div>

      <ParticipantTimeline timeline={timeline} />

      <AdminHistory entries={history} emptyMessage="Nenhuma ação do painel nesta conta." />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
