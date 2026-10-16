import { HomeBack } from "@/features/auth/ui/HomeBack";
import { routeAction, routeLoader } from "@/server/route-loader.server";
import { USER_AUTH_BASE_PATH } from "@/features/auth/server/participant-auth.server";
import { handleParticipantAuth } from "@/features/auth/server/participant-auth-route.server";
import { signInFromForm } from "@/features/auth/server/native-auth-actions.server";
import { useLoaderData } from "react-router";

import { redirect } from "@/server/http.server";
import { SignInForm } from "@/features/auth/ui/SignInForm";
import { accessContext } from "@/features/auth/domain/access-context";
import { APP_START, safeReturnPath } from "@/features/auth/domain/return-path";
import { getUserSession } from "@/features/auth/server/participant-session.server";
import { noticeFor } from "@/lib/notice";
import { SESSION_ENDED_NOTICE } from "@/features/auth/domain/session-ended";

export const meta = () => [{ title: "Entrar · Nelcota" }];

const NOTICES: Record<string, string> = {
  senha: "Senha alterada. Entre com a nova senha.",
  saiu: "Você saiu da sua conta.",
  sessao: "Sua sessão expirou. Entre de novo para continuar.",
  [SESSION_ENDED_NOTICE]: "Sua sessão foi encerrada em outro aparelho.",
};

export const loader = routeLoader(async ({ searchParams }) => {
  const { voltar, aviso } = searchParams;
  const returnTo = safeReturnPath(voltar, APP_START);
  if (await getUserSession()) redirect(returnTo);

  return { aviso, returnTo };
});

/** The form posted without JS (page not hydrated yet, or a script failed to load). */
export const action = routeAction(({ request, searchParams }) => {
  const returnTo = safeReturnPath(searchParams.voltar, APP_START);
  return signInFromForm(
    request,
    { handle: handleParticipantAuth, basePath: USER_AUTH_BASE_PATH },
    { done: returnTo, secondFactor: `/entrar/2fa?voltar=${encodeURIComponent(returnTo)}` },
  );
});

export default function SignInPage() {
  const { aviso, returnTo } = useLoaderData<typeof loader>();
  return (
    <>
      <HomeBack />
      <SignInForm
        returnTo={returnTo}
        context={accessContext(returnTo)}
        notice={noticeFor(NOTICES, aviso)}
      />
    </>
  );
}
