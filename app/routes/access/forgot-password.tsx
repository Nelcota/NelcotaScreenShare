import { routeAction } from "@/server/route-loader.server";
import { USER_AUTH_BASE_PATH } from "@/features/auth/server/participant-auth.server";
import { handleParticipantAuth } from "@/features/auth/server/participant-auth-route.server";
import { passwordResetFromForm } from "@/features/auth/server/native-auth-actions.server";
import { ForgotPasswordForm } from "@/features/auth/ui/PasswordForms";

export const meta = () => [{ title: "Recuperar senha · Nelcota" }];

/** The e-mail posted without JS. */
export const action = routeAction(({ request }) =>
  passwordResetFromForm(
    request,
    { handle: handleParticipantAuth, basePath: USER_AUTH_BASE_PATH },
    { redirectTo: "/redefinir-senha" },
  ),
);

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm scope="user" />;
}
