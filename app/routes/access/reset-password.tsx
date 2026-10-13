import { routeAction } from "@/server/route-loader.server";
import { PASSWORD_LIMITS } from "@/features/auth/domain/password-rules";
import { USER_AUTH_BASE_PATH } from "@/features/auth/server/participant-auth.server";
import { handleParticipantAuth } from "@/features/auth/server/participant-auth-route.server";
import { passwordChangeFromForm } from "@/features/auth/server/native-auth-actions.server";
import { useLoaderData } from "react-router";

import { ResetPasswordForm } from "@/features/auth/ui/PasswordForms";
import { resetPasswordLoader } from "@/features/auth/server/reset-password-loader.server";

export const meta = () => [{ title: "Nova senha · Nelcota" }];

export const loader = resetPasswordLoader;

/** The new password posted without JS. */
export const action = routeAction(({ request, searchParams }) =>
  passwordChangeFromForm(
    request,
    { handle: handleParticipantAuth, basePath: USER_AUTH_BASE_PATH },
    { token: searchParams.token, minLength: PASSWORD_LIMITS.user.min, done: "/entrar?aviso=senha" },
  ),
);

export default function ResetPasswordPage() {
  const { token } = useLoaderData<typeof loader>();
  return <ResetPasswordForm scope="user" token={token} />;
}
