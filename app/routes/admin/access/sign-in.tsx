import { routeAction, routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { redirect } from "@/server/http.server";
import { AdminSignInForm } from "@/features/auth/ui/AdminSignInForm";
import { AdminDisabled } from "@/features/auth/ui/AdminDisabled";
import { ADMIN_AUTH_BASE_PATH, getAdminAuth } from "@/features/auth/server/admin-auth.server";
import { handleAdminAuth } from "@/features/auth/server/admin-auth-route.server";
import { signInFromForm } from "@/features/auth/server/native-auth-actions.server";
import { getAdminSession } from "@/features/auth/server/admin-session.server";
import { noticeFor } from "@/lib/notice";

const NOTICES: Record<string, string> = {
  convite: "Conta criada. Entre com seu e-mail e a senha que você escolheu.",
  senha: "Senha alterada. Entre com a nova senha.",
  saiu: "Você saiu do painel.",
};

export const loader = routeLoader(async ({ searchParams }) => {
  if (!getAdminAuth()) return { disabled: true, notice: undefined };
  if (await getAdminSession()) redirect("/admin");
  const { aviso } = searchParams;
  const notice = noticeFor(NOTICES, aviso);

  return { notice, disabled: false };
});

/** The form posted without JS (page not hydrated yet, or a script failed to load). */
export const action = routeAction(({ request }) =>
  signInFromForm(
    request,
    { handle: handleAdminAuth, basePath: ADMIN_AUTH_BASE_PATH },
    { done: "/admin", secondFactor: "/admin/verificar-2fa" },
  ),
);

export default function AdminSignInPage() {
  const { notice, disabled } = useLoaderData<typeof loader>();
  if (disabled) return <AdminDisabled />;
  return <AdminSignInForm notice={notice} />;
}
