import { routeAction, routeLoader } from "@/server/route-loader.server";
import { USER_AUTH_BASE_PATH } from "@/features/auth/server/participant-auth.server";
import { handleParticipantAuth } from "@/features/auth/server/participant-auth-route.server";
import { secondFactorFromForm } from "@/features/auth/server/native-auth-actions.server";
import { useLoaderData } from "react-router";

import { TwoFactorCodeForm } from "@/features/auth/ui/TwoFactorCodeForm";
import { safeReturnPath } from "@/features/auth/domain/return-path";

export const meta = () => [{ title: "Verificação em duas etapas · Nelcota" }];

export const loader = routeLoader(async ({ searchParams }) => {
  const { voltar } = searchParams;
  const returnTo = safeReturnPath(voltar);

  return { returnTo };
});

/** The code posted without JS. */
export const action = routeAction(({ request, searchParams }) =>
  secondFactorFromForm(
    request,
    { handle: handleParticipantAuth, basePath: USER_AUTH_BASE_PATH },
    { done: safeReturnPath(searchParams.voltar) },
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
