import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { MascotSettingsForm } from "@/features/admin/settings/ui/MascotSettingsForm";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import {
  getSetting,
  MASCOT_SATURATION,
  mascotSettings,
} from "@/features/admin/settings/server/settings.server";

export const meta = () => [{ title: "Configurações · Nelcota" }];

export const loader = routeLoader(async () => {
  const admin = await requireAdmin({ settings: ["read"] });
  const mascot = await getSetting(mascotSettings);

  const canEdit = can(admin.user.role, { settings: ["update"] });
  return { mascot, defaults: mascotSettings.defaults, limits: MASCOT_SATURATION, canEdit };
});

export default function AdminSettingsPage() {
  const { mascot, defaults, limits, canEdit } = useLoaderData<typeof loader>();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
      <MascotSettingsForm initial={mascot} defaults={defaults} limits={limits} canEdit={canEdit} />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
