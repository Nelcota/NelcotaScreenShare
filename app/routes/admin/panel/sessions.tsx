import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { revokeOtherOwnSessions, revokeOwnSession } from "@/features/admin/account/actions";
import { SessionList } from "@/features/security/ui/SessionList";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { listActiveSessions } from "@/features/auth/server/sessions.server";
import { getDb } from "@/server/db/index.server";
import { adminSessions } from "@/server/db/schema";

export const meta = () => [{ title: "Sessões ativas · Nelcota" }];

export const loader = routeLoader(async () => {
  const admin = await requireAdmin(undefined, { allowWithoutTwoFactor: true });
  const rows = await listActiveSessions(getDb(), adminSessions, admin.user.id);

  return { currentId: admin.session.id, rows };
});

export default function AccountSessionsPage() {
  const { currentId, rows } = useLoaderData<typeof loader>();
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sessões ativas</h1>
        <p className="mt-1 text-ink-muted">
          Onde sua conta está conectada. Encerre o que você não reconhecer e troque a senha.
        </p>
      </div>
      <SessionList
        currentId={currentId}
        revokeSession={revokeOwnSession}
        revokeOtherSessions={revokeOtherOwnSessions}
        sessions={rows}
      />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
