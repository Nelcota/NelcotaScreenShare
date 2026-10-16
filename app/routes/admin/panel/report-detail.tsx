import { routeLoader } from "@/server/route-loader.server";
import { Link, useLoaderData } from "react-router";

import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Facts, Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { REASON_LABELS, RESOLUTION_LABELS } from "@/features/reports/domain/reports";
import { getReport } from "@/features/admin/reports/server/queries.server";
import { ReportActions } from "@/features/admin/reports/ui/ReportActions";
import { ReportContext } from "@/features/admin/reports/ui/ReportContext";
import { getDb } from "@/server/db/index.server";
import { notFound } from "@/server/http.server";
import { formatDateTime } from "@/lib/format";

export const meta = () => [{ title: "Denúncia · Nelcota" }];

export const loader = routeLoader(async ({ params }) => {
  const admin = await requireAdmin({ report: ["read"] });
  const id = params.id ?? "";
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getReport(getDb(), id);
  if (!detail) notFound();
  const role = admin.user.role;
  const canResolve = detail.report.status === "open" && can(role, { report: ["resolve"] });
  return {
    detail,
    canResolve,
    canDeleteMessage: canResolve && detail.report.targetMessageId !== null,
    canBlock:
      canResolve &&
      detail.report.targetUserId !== null &&
      !detail.report.targetBlocked &&
      can(role, { participant: ["update"] }),
  };
});

/** Who or what was reported, named for the facts list. */
const FACT_LABELS = { user: "Pessoa", message: "Autor", conversation: "Grupo" } as const;

function PersonLink({ id, name }: { id: string | null; name: string | null }) {
  if (!id) return <>Conta apagada</>;
  return (
    <Link viewTransition to={`/admin/usuarios/${id}`} className="hover:underline">
      {name ?? "Participante"}
    </Link>
  );
}

type Report = ReturnType<typeof useLoaderData<typeof loader>>["detail"]["report"];

function Target({ report }: { report: Report }) {
  if (report.targetKind === "conversation")
    return <>{report.conversationName ?? "Grupo sem nome"}</>;
  return <PersonLink id={report.targetUserId} name={report.targetName} />;
}

function ReportFacts({ report }: { report: Report }) {
  const conversation: [string, string][] =
    report.targetKind === "message"
      ? [["Conversa", report.conversationName ?? "Conversa direta"]]
      : [];
  const resolved: [string, string][] = report.resolvedAt
    ? [["Resolvida em", formatDateTime(report.resolvedAt)]]
    : [];
  return (
    <Facts
      items={[
        [FACT_LABELS[report.targetKind], <Target key="alvo" report={report} />],
        ...conversation,
        ["Detalhes", report.details ?? "—"],
        [
          "Quem denunciou",
          <PersonLink key="autor" id={report.reporterId} name={report.reporterName} />,
        ],
        ["Quando", formatDateTime(report.createdAt)],
        ...resolved,
      ]}
    />
  );
}

export default function AdminReportPage() {
  const { detail, canResolve, canDeleteMessage, canBlock } = useLoaderData<typeof loader>();
  const { report } = detail;
  return (
    <>
      <div className="flex flex-col gap-3">
        <Link
          viewTransition
          to="/admin/denuncias"
          className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Denúncias
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{REASON_LABELS[report.reason]}</h1>
          {report.resolution ? (
            <StatusBadge tone="neutral">{RESOLUTION_LABELS[report.resolution]}</StatusBadge>
          ) : (
            <StatusBadge tone="warning">Aberta</StatusBadge>
          )}
        </div>
        {canResolve ? (
          <ReportActions id={report.id} canDeleteMessage={canDeleteMessage} canBlock={canBlock} />
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Denúncia">
          <ReportFacts report={report} />
        </Section>
        {report.targetKind === "user" ? null : (
          <Section title="Conversa">
            <ReportContext detail={detail} />
          </Section>
        )}
      </div>
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
