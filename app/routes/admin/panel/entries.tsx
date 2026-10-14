import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { Section } from "@/components/Section";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { isDenialReason, REASON_LABELS } from "@/features/admin/entries/domain/reasons";
import { denialsByReason, recentDenials } from "@/features/admin/entries/server/queries.server";
import { DenialsList } from "@/features/admin/entries/ui/DenialsList";
import { ReasonSummary } from "@/features/admin/entries/ui/ReasonSummary";
import { getDb } from "@/server/db/index.server";
import { AdminPageHeader } from "@/features/admin/shell/ui/AdminPageHeader";

export const meta = () => [{ title: "Entradas negadas · Nelcota" }];

export const loader = routeLoader(async ({ searchParams }) => {
  await requireAdmin({ room: ["read"] });
  const reason = isDenialReason(searchParams.motivo) ? searchParams.motivo : null;
  const db = getDb();
  const [counts, recent] = await Promise.all([denialsByReason(db), recentDenials(db, reason)]);
  return { counts, recent, reason };
});

export default function AdminEntriesPage() {
  const { counts, recent, reason } = useLoaderData<typeof loader>();
  return (
    <>
      <AdminPageHeader
        title="Entradas negadas"
        description="Quem tentou entrar numa sala e não conseguiu."
      />
      <Section title="Por motivo">
        <ReasonSummary counts={counts} selected={reason} />
      </Section>
      <Section title={reason ? REASON_LABELS[reason] : "Últimas negadas"}>
        <DenialsList rows={recent} />
      </Section>
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
