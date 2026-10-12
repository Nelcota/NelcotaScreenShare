import { useLoaderData } from "react-router";
import { routeLoader } from "@/server/route-loader.server";
import { getDb } from "@/server/db/index.server";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { betaSubjects } from "@/features/admin/beta/server/queries.server";
import { ProvisionForm } from "@/features/admin/beta/ui/ProvisionForm";
export const meta = () => [{ title: "Pro beta · Nelcota" }];
export const loader = routeLoader(async ({ searchParams }) => {
  const admin = await requireAdmin({ beta: ["read"] });
  return {
    subjects: await betaSubjects(getDb(), searchParams.busca),
    canEdit: can(admin.user.role, { beta: ["update"] }),
  };
});
export default function BetaPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Pro beta</h1>
      <ProvisionForm {...useLoaderData<typeof loader>()} />
    </>
  );
}
export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
