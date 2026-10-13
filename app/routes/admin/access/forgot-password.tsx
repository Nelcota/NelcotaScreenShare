import { routeAction } from "@/server/route-loader.server";
import { ADMIN_AUTH_BASE_PATH } from "@/features/auth/server/admin-auth.server";
import { handleAdminAuth } from "@/features/auth/server/admin-auth-route.server";
import { passwordResetFromForm } from "@/features/auth/server/native-auth-actions.server";
import { ForgotPasswordForm } from "@/features/auth/ui/PasswordForms";

/** The e-mail posted without JS. */
export const action = routeAction(({ request }) =>
  passwordResetFromForm(
    request,
    { handle: handleAdminAuth, basePath: ADMIN_AUTH_BASE_PATH },
    { redirectTo: "/admin/redefinir-senha" },
  ),
);

export default function AdminForgotPasswordPage() {
  return <ForgotPasswordForm scope="admin" />;
}
