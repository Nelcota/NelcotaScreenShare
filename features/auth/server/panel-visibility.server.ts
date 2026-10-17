import { and, eq, gt, sql } from "drizzle-orm";
import { RouterContextProvider } from "react-router";
import { classifyPanelPath, type PanelPath } from "@/features/auth/domain/panel-paths";
import {
  ADMIN_PASS_COOKIE,
  adminPassCookie,
  readCookie,
  signAdminPass,
  verifyAdminPass,
} from "@/features/auth/server/admin-pass.server";
import { getAdminSession } from "@/features/auth/server/admin-session.server";
import { findPendingInvitation } from "@/features/auth/server/admin-invitations.server";
import { isPanelMember } from "@/features/auth/server/panel-member.server";
import { getUserSession } from "@/features/auth/server/participant-session.server";
import { getDb } from "@/server/db/index.server";
import { adminVerifications } from "@/server/db/schema";
import { appUrl, getEnv } from "@/server/env.server";
import { withRequest } from "@/server/request-context.server";

/** A new-password link still waiting to be used (Better Auth's identifier). */
async function resetTokenIsValid(token: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: adminVerifications.id })
    .from(adminVerifications)
    .where(
      and(
        eq(adminVerifications.identifier, `reset-password:${token}`),
        gt(adminVerifications.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  return row !== undefined;
}

async function tokenIsValid(path: PanelPath): Promise<boolean> {
  if (path.kind === "invitation")
    return (await findPendingInvitation(getDb(), path.token)) !== undefined;
  if (path.kind === "reset") return resetTokenIsValid(path.token);
  return false;
}

/** A panel session, the short pass, or an app account of someone on the team. */
async function canSeePanel(request: Request, secret: string): Promise<boolean> {
  if (verifyAdminPass(readCookie(request.headers, ADMIN_PASS_COOKIE), secret)) return true;
  if (await getAdminSession()) return true;
  const current = await getUserSession();
  return isPanelMember(current?.user);
}

/** What happens to a request, as far as hiding the panel goes. */
export type PanelVerdict =
  | { kind: "through" }
  | { kind: "hidden" }
  | { kind: "grant"; cookie: string };

/**
 * Hides the panel (/admin, its data requests and /api/admin/*) from anyone who is not on
 * the team: no panel session, no pass and no app account with a team member's verified
 * e-mail. A valid invitation, owner recovery or new-password link always opens and grants a
 * 30-minute pass to the panel's sign-in, so nobody on the team is locked out.
 */
export async function panelVerdict(request: Request): Promise<PanelVerdict> {
  const url = new URL(request.url);
  const path = classifyPanelPath(url.pathname, url.searchParams);
  if (path.kind === "outside") return { kind: "through" };
  const secret = getEnv().ADMIN_AUTH_SECRET;
  if (!secret) return { kind: "hidden" };
  return withRequest(request, new RouterContextProvider(), async () => {
    if (path.kind === "invitation" || path.kind === "reset") {
      if (!(await tokenIsValid(path))) return { kind: "hidden" };
      const secure = appUrl().startsWith("https://");
      return { kind: "grant", cookie: adminPassCookie(signAdminPass(secret), secure) };
    }
    if (await canSeePanel(request, secret)) return { kind: "through" };
    return { kind: "hidden" };
  });
}

/** An address that matches no route, so the site answers with its own 404 page. */
const NOWHERE = "/nao-encontrado";

/**
 * The same request sent to an address that does not exist, keeping a data request a data
 * request: the answer is exactly the one for any wrong address, header and footer included.
 */
export function hiddenPanelUrl(url: URL): URL {
  const target = new URL(url);
  target.pathname = url.pathname.endsWith(".data") ? `${NOWHERE}.data` : NOWHERE;
  target.search = "";
  return target;
}
