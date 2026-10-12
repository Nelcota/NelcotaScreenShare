import { requestHeaders, requestMemo as cache } from "@/server/request-context.server";
import { redirect } from "@/server/http.server";
import { logger } from "@/server/logger.server";
import { sessionWithCookies } from "@/server/response-cookies.server";
import { getAdminAuth } from "./admin-auth.server";
import { can, type PermissionRequest } from "./permissions.server";
import { isAdminRole, ROLES_REQUIRING_2FA, type AdminRole } from "@/features/auth/domain/roles";

/** Absolute maximum for a session, even with continuous use. */
const ADMIN_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface AdminSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
    twoFactorEnabled: boolean;
  };
  session: { id: string; token: string; createdAt: Date; expiresAt: Date };
}

/**
 * Admin session of the request (DAL): validated in the database on every request
 * (no cookie cache), once per render thanks to React's `cache`.
 * Disabled account, unknown role or session past the absolute maximum = no session.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const auth = getAdminAuth();
  if (!auth) return null;
  const result = await sessionWithCookies(
    auth.api.getSession({ headers: requestHeaders(), returnHeaders: true }),
  );
  if (!result) return null;
  const { user, session } = result;
  if (user.banned || !isAdminRole(user.role)) return null;
  if (Date.now() - new Date(session.createdAt).getTime() > ADMIN_SESSION_MAX_AGE_MS) {
    await auth.api
      .revokeSession({ body: { token: session.token }, headers: requestHeaders() })
      // The session is already refused here; revoking only cleans the database sooner.
      .catch((error: unknown) => logger.warn({ err: error }, "failed to revoke expired session"));
    return null;
  }
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
    },
    session: {
      id: session.id,
      token: session.token,
      createdAt: new Date(session.createdAt),
      expiresAt: new Date(session.expiresAt),
    },
  };
});

export function needsTwoFactorSetup(admin: AdminSession): boolean {
  return ROLES_REQUIRING_2FA.includes(admin.user.role) && !admin.user.twoFactorEnabled;
}

/**
 * Requires a signed-in admin (and, by default, with 2FA when the role requires it)
 * and the requested permission. Use at the top of panel pages and layouts. Operations
 * use the same criteria through `defineAdminOperation`, and API routes through
 * `requireAdminApi`.
 */
export async function requireAdmin(
  permission?: PermissionRequest,
  { allowWithoutTwoFactor = false }: { allowWithoutTwoFactor?: boolean } = {},
): Promise<AdminSession> {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/entrar");
  if (!allowWithoutTwoFactor && needsTwoFactorSetup(admin)) redirect("/admin/conta/seguranca");
  if (permission && !can(admin.user.role, permission)) redirect("/admin/sem-permissao");
  return admin;
}
