import { HomeBack } from "@/features/auth/ui/HomeBack";
import { routeAction, routeLoader } from "@/server/route-loader.server";
import { USER_AUTH_BASE_PATH } from "@/features/auth/server/participant-auth.server";
import { handleParticipantAuth } from "@/features/auth/server/participant-auth-route.server";
import { signUpFromForm } from "@/features/auth/server/native-auth-actions.server";
import { useLoaderData } from "react-router";

import { redirect } from "@/server/http.server";
import { SignUpForm } from "@/features/auth/ui/SignUpForm";
import { accessContext } from "@/features/auth/domain/access-context";
import { safeReturnPath } from "@/features/auth/domain/return-path";
import { getUserSession } from "@/features/auth/server/participant-session.server";
import { getEnv } from "@/server/env.server";

export const meta = () => [{ title: "Criar conta · Nelcota" }];

export const loader = routeLoader(async ({ searchParams }) => {
  const { voltar } = searchParams;
  const returnTo = safeReturnPath(voltar);
  if (await getUserSession()) redirect(returnTo);

  const verificationRequired = getEnv().REQUIRE_EMAIL_VERIFICATION;
  return { returnTo, verificationRequired };
});

/** The form posted without JS (page not hydrated yet, or a script failed to load). */
export const action = routeAction(({ request, searchParams }) =>
  signUpFromForm(
    request,
    { handle: handleParticipantAuth, basePath: USER_AUTH_BASE_PATH },
    {
      returnTo: safeReturnPath(searchParams.voltar),
      verificationRequired: getEnv().REQUIRE_EMAIL_VERIFICATION,
    },
  ),
);

export default function SignUpPage() {
  const { returnTo, verificationRequired } = useLoaderData<typeof loader>();
  return (
    <>
      <HomeBack />
      <SignUpForm
        returnTo={returnTo}
        context={accessContext(returnTo)}
        verificationRequired={verificationRequired}
      />
    </>
  );
}
