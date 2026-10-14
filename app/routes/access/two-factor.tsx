import { routeAction, routeLoader } from "@/server/route-loader.server";
import { USER_AUTH_BASE_PATH } from "@/features/auth/server/participant-auth.server";
import { handleParticipantAuth } from "@/features/auth/server/participant-auth-route.server";
import { secondFactorFromForm } from "@/features/auth/server/native-auth-actions.server";
import { redirect, useLoaderData } from "react-router";

import { TwoFactorCodeForm } from "@/features/auth/ui/TwoFactorCodeForm";
import { APP_START, safeReturnPath } from "@/features/auth/domain/return-path";

export const meta = () => [{ title: "Verificação em duas etapas · Nelcota" }];

/** The cookie Better Auth sets between the password and the code (`__Secure-` in production). */
const PENDING_SECOND_FACTOR = /(?:^|;\s*)(?:__Secure-)?nelcota\.two_factor=/;

/** Only a sign-in waiting for its code shows the form; otherwise it would fail after typing. */
export const loader = routeLoader(({ request, searchParams }) => {
  const returnTo = safeReturnPath(searchParams.voltar, APP_START);
  if (!PENDING_SECOND_FACTOR.test(request.headers.get("cookie") ?? "")) {
    throw redirect(`/entrar?voltar=${encodeURIComponent(returnTo)}`);
  }
  return { returnTo };
});

/** The code posted without JS. */
export const action = routeAction(({ request, searchParams }) =>
  secondFactorFromForm(
    request,
    { handle: handleParticipantAuth, basePath: USER_AUTH_BASE_PATH },
    { done: safeReturnPath(searchParams.voltar, APP_START) },
  ),
);

export default function SignInTwoFactorPage() {
  const { returnTo } = useLoaderData<typeof loader>();
  return (
    <TwoFactorCodeForm
      scope="user"
      doneHref={returnTo}
      backHref={`/entrar?voltar=${encodeURIComponent(returnTo)}`}
    />
  );
}
