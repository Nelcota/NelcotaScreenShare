import { routeAction } from "@/server/route-loader.server";
import { PASSWORD_LIMITS } from "@/features/auth/domain/password-rules";
import { ADMIN_AUTH_BASE_PATH } from "@/features/auth/server/admin-auth.server";
import { handleAdminAuth } from "@/features/auth/server/admin-auth-route.server";
import { passwordChangeFromForm } from "@/features/auth/server/native-auth-actions.server";
import { useLoaderData } from "react-router";

import { ResetPasswordForm } from "@/features/auth/ui/PasswordForms";
import { resetPasswordLoader } from "@/features/auth/server/reset-password-loader.server";

export const loader = resetPasswordLoader;

/** The new password posted without JS. */
export const action = routeAction(({ request, searchParams }) =>
  passwordChangeFromForm(
    request,
    { handle: handleAdminAuth, basePath: ADMIN_AUTH_BASE_PATH },
    {
      token: searchParams.token,
      minLength: PASSWORD_LIMITS.admin.min,
      done: "/admin/entrar?aviso=senha",
    },
  ),
);

export default function AdminResetPasswordPage() {
  const { token } = useLoaderData<typeof loader>();
  return <ResetPasswordForm scope="admin" token={token} />;
}
