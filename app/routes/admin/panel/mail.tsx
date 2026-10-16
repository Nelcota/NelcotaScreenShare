import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { Section } from "@/components/Section";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { mailConfiguration } from "@/features/admin/mail/domain/configuration";
import { deliveryCounts, listRecentDeliveries } from "@/features/admin/mail/server/queries.server";
import { DeliveriesTable } from "@/features/admin/mail/ui/DeliveriesTable";
import { MailSenderForm } from "@/features/admin/mail/ui/MailSenderForm";
import { MailSetup } from "@/features/admin/mail/ui/MailSetup";
import { TestMailButton } from "@/features/admin/mail/ui/TestMailButton";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { currentMailSender } from "@/server/mail-sender.server";
import { formatNumber } from "@/lib/format";
import { AdminPageHeader } from "@/features/admin/shell/ui/AdminPageHeader";

export const meta = () => [{ title: "E-mails · Nelcota" }];

export const loader = routeLoader(async () => {
  const admin = await requireAdmin({ mail: ["read"] });
  const db = getDb();
  const [deliveries, counts, sender] = await Promise.all([
    listRecentDeliveries(db),
    deliveryCounts(db),
    currentMailSender(db),
  ]);
  const env = getEnv();
  // Only the owner edits the sender, so only the owner sees it.
  const senderForm = can(admin.user.role, { settings: ["update"] })
    ? { saved: sender.fromPanel ? sender.value : null, hosting: env.MAIL_FROM ?? null }
    : null;
  return {
    configuration: mailConfiguration(env, sender),
    deliveries,
    counts,
    canTest: can(admin.user.role, { mail: ["test"] }),
    senderForm,
  };
});

function plural(value: number, one: string, many: string): string {
  return `${formatNumber(value)} ${value === 1 ? one : many}`;
}

function CountsLine({ counts }: { counts: { accepted: number; refused: number } }) {
  const accepted = plural(counts.accepted, "aceito", "aceitos");
  const refused = plural(counts.refused, "não saiu", "não saíram");
  return <>{`Últimas 24 h: ${accepted}, ${refused}.`}</>;
}

export default function AdminMailPage() {
  const { configuration, deliveries, counts, canTest, senderForm } = useLoaderData<typeof loader>();
  return (
    <>
      <AdminPageHeader
        title="E-mails"
        description="Envios de confirmação de conta e de nova senha."
      />
      <Section
        title="Configuração"
        action={canTest && configuration.issues.length === 0 ? <TestMailButton /> : null}
      >
        <MailSetup configuration={configuration} />
        {senderForm ? <MailSenderForm {...senderForm} /> : null}
      </Section>
      <Section title="Últimos envios" description={<CountsLine counts={counts} />}>
        <DeliveriesTable rows={deliveries} />
      </Section>
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
