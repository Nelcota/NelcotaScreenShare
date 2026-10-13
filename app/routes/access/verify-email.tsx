import { HomeBack } from "@/features/auth/ui/HomeBack";
import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { redirect } from "@/server/http.server";
import { z } from "zod";
import { verifyJWT } from "better-auth/crypto";
import { VerifyEmailPanel } from "@/features/auth/ui/VerifyEmailPanel";
import { ConfirmEmailPanel } from "@/features/auth/ui/ConfirmEmailPanel";
import { APP_START, safeReturnPath } from "@/features/auth/domain/return-path";
import { getUserSession } from "@/features/auth/server/participant-session.server";
import { getEnv } from "@/server/env.server";

export const meta = () => [{ title: "Confirme seu e-mail · Nelcota" }];

export const loader = routeLoader(async ({ searchParams }) => {
  const { voltar, email, token } = searchParams;
  const returnTo = safeReturnPath(voltar, APP_START);
  const current = await getUserSession();
  if (typeof token === "string" && token.length <= 4096) {
    const payload = await verifyJWT<Record<string, unknown>>(token, getEnv().AUTH_SECRET);
    if (payload && typeof payload.email === "string") {
      const query = new URLSearchParams({ token, callbackURL: returnTo });
      const continuation = `/verificar-email?${new URLSearchParams({ token, voltar: returnTo })}`;
      return {
        returnTo,
        address: undefined,
        confirmation: {
          confirmationHref:
            current?.user.email === payload.email ? `/api/auth/verify-email?${query}` : null,
          signInHref: `/entrar?voltar=${encodeURIComponent(continuation)}`,
          signedIn: current !== null,
        },
      };
    }
  }
  if (current?.user.emailVerified) redirect(returnTo);
  // Signed in but unconfirmed: use the account e-mail. Right after sign-up: what the person typed.
  const typed = z.email().safeParse(email);
  const address = current?.user.email ?? (typed.success ? typed.data : undefined);

  return { returnTo, address, confirmation: null };
});

export default function VerifyEmailPage() {
  const { returnTo, address, confirmation } = useLoaderData<typeof loader>();
  return (
    <>
      <HomeBack />
      {confirmation ? (
        <ConfirmEmailPanel {...confirmation} />
      ) : (
        <VerifyEmailPanel email={address} returnTo={returnTo} />
      )}
    </>
  );
}
