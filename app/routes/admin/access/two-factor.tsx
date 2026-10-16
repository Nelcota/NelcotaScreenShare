import { routeAction } from "@/server/route-loader.server";
import { ADMIN_AUTH_BASE_PATH } from "@/features/auth/server/admin-auth.server";
import { handleAdminAuth } from "@/features/auth/server/admin-auth-route.server";
import { secondFactorFromForm } from "@/features/auth/server/native-auth-actions.server";
import { TwoFactorCodeForm } from "@/features/auth/ui/TwoFactorCodeForm";

/** The code posted without JS. */
export const action = routeAction(({ request }) =>
  secondFactorFromForm(
    request,
    { handle: handleAdminAuth, basePath: ADMIN_AUTH_BASE_PATH },
    { done: "/admin" },
  ),
);

export default function AdminVerifyTwoFactorPage() {
  return <TwoFactorCodeForm scope="admin" doneHref="/admin" backHref="/admin/entrar" />;
}
