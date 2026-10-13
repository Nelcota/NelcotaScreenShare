import { ActionError } from "@/server/operations/action-error";
import { SESSION_EXPIRED_MESSAGE } from "@/features/auth/domain/auth-errors";
import { defineOperation, type BasePolicy } from "@/server/operations/define-operation.server";
import { createAuditRecorder, type AuditRecorder } from "@/server/audit.server";
import { requestHeaders } from "@/server/request-context.server";
import { clientIpFrom } from "@/server/client-ip.server";
import { createRateLimiter, type RateLimiter } from "@/server/rate-limit.server";
import { getAdminSession, needsTwoFactorSetup, type AdminSession } from "./admin-session.server";
import { getUserSession, type UserSession } from "./participant-session.server";
import { can, type PermissionRequest } from "./permissions.server";
import { FRESH_SESSION_SECONDS } from "./auth-shared.server";

/** Who may call: an admin or participant session, or rate-limited public access. */
interface Policy extends BasePolicy {
  permission?: PermissionRequest;
  fresh?: boolean;
  allowWithoutTwoFactor?: boolean;
}
type AdminContext = {
  admin: AdminSession;
  audit: AuditRecorder;
};
type UserContext = {
  current: UserSession;
  audit: AuditRecorder;
};
const publicLimiters = new Map<string, RateLimiter>();

function checkFresh(createdAt: Date, policy: Policy) {
  if (policy.fresh && Date.now() - createdAt.getTime() > FRESH_SESSION_SECONDS * 1000) {
    throw new ActionError("Por segurança, entre de novo para fazer isso.");
  }
}

export const defineAdminOperation = defineOperation<Policy, AdminContext>(async (policy) => {
  const admin = await getAdminSession();
  if (!admin) throw new ActionError(SESSION_EXPIRED_MESSAGE);
  if (!policy.allowWithoutTwoFactor && needsTwoFactorSetup(admin)) {
    throw new ActionError("Ative a verificação em duas etapas para continuar.");
  }
  if (policy.permission && !can(admin.user.role, policy.permission)) {
    throw new ActionError("Você não tem permissão para fazer isso.");
  }
  checkFresh(admin.session.createdAt, policy);
  return { admin, audit: createAuditRecorder({ adminId: admin.user.id }) };
});

export const defineUserOperation = defineOperation<Policy, UserContext>(async (policy) => {
  const current = await getUserSession();
  if (!current) throw new ActionError(SESSION_EXPIRED_MESSAGE);
  checkFresh(current.session.createdAt, policy);
  return { current, audit: createAuditRecorder({ userId: current.user.id }) };
});

/** One limiter per public operation, created on first use. */
function publicLimiterFor(name: string) {
  const existing = publicLimiters.get(name);
  if (existing) return existing;
  const created = createRateLimiter({ limit: 10, windowMs: 15 * 60_000 });
  publicLimiters.set(name, created);
  return created;
}

export const definePublicOperation = defineOperation(async (policy: Policy) => {
  if (!publicLimiterFor(policy.name).hit(clientIpFrom(requestHeaders()) ?? "desconhecido").ok) {
    throw new ActionError("Muitas tentativas. Aguarde alguns minutos.");
  }
  return { audit: createAuditRecorder("system") };
});
