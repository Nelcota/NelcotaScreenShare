import { sql } from "drizzle-orm";
import { requestHeaders, requestMemo as cache } from "@/server/request-context.server";
import { redirect } from "@/server/http.server";
import { getDb } from "@/server/db/index.server";
import { users } from "@/server/db/schema";
import { safeReturnPath } from "@/features/auth/domain/return-path";
import { getEnv } from "@/server/env.server";
import { logger } from "@/server/logger.server";
import { sessionWithCookies } from "@/server/response-cookies.server";
import { getUserAuth } from "./participant-auth.server";

export interface UserSession {
  user: {
    id: string;
    name: string;
    image: string | null;
    email: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
  };
  session: { id: string; createdAt: Date };
}

/**
 * Participant session (DAL), once per render. Blocked or deleted account =
 * no session (blocking in the panel also ends the sessions).
 */
export const getUserSession = cache(async (): Promise<UserSession | null> => {
  const result = await sessionWithCookies(
    getUserAuth().api.getSession({ headers: requestHeaders(), returnHeaders: true }),
  );
  if (!result) return null;
  const { user, session } = result;
  if (user.blockedAt || user.deletedAt) return null;
  // Last access (at most one write per hour per person).
  const lastSeenAt = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
  if (lastSeenAt < Date.now() - 60 * 60 * 1000) {
    await getDb()
      .update(users)
      .set({ lastSeenAt: sql`now()` })
      .where(
        sql`${users.id} = ${user.id} and (${users.lastSeenAt} is null or ${users.lastSeenAt} < now() - interval '1 hour')`,
      )
      // Just a statistic: failing here must not prevent the page from opening.
      .catch((error: unknown) => logger.warn({ err: error }, "failed to record last access"));
  }
  return {
    user: {
      id: user.id,
      name: user.name,
      image: user.image ?? null,
      email: user.email,
      emailVerified: user.emailVerified,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
    },
    session: { id: session.id, createdAt: new Date(session.createdAt) },
  };
});

/**
 * Requires sign-in (and a verified e-mail, when REQUIRE_EMAIL_VERIFICATION is
 * on); otherwise redirects to /entrar or /verificar-email and comes back afterwards.
 */
export async function requireUser(
  returnTo: string,
  { requireVerified = true }: { requireVerified?: boolean } = {},
): Promise<UserSession> {
  const current = await getUserSession();
  if (!current) redirect(`/entrar?voltar=${encodeURIComponent(safeReturnPath(returnTo))}`);
  if (requireVerified && getEnv().REQUIRE_EMAIL_VERIFICATION && !current.user.emailVerified) {
    redirect(`/verificar-email?voltar=${encodeURIComponent(safeReturnPath(returnTo))}`);
  }
  return current;
}
