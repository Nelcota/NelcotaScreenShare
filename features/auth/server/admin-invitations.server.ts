import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { adminInvitations, adminUsers } from "@/server/db/schema";
import { appUrl } from "@/server/env.server";
import type { AdminAuth } from "./admin-auth.server";
import { PASSWORD_LIMITS } from "@/features/auth/domain/password-rules";
import type { AdminRole } from "@/features/auth/domain/roles";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;
/** Invitation from the first owner's bootstrap script: short on purpose. */
export const OWNER_BOOTSTRAP_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function invitationUrl(token: string): string {
  return `${appUrl()}/admin/convite/${token}`;
}

/**
 * Creates an invitation (the token only exists in the return value; the database stores the SHA-256).
 * A previous pending invitation for the same e-mail is revoked.
 */
export async function createAdminInvitation(
  db: Database,
  {
    email,
    role,
    invitedBy,
    ttlMs = INVITE_TTL_MS,
  }: { email: string; role: AdminRole; invitedBy: string | null; ttlMs?: number },
) {
  const token = randomBytes(32).toString("base64url");
  const normalized = email.trim().toLowerCase();
  const invitation = await db.transaction(async (tx) => {
    await tx
      .update(adminInvitations)
      .set({ status: "revoked" })
      .where(
        and(
          sql`lower(${adminInvitations.email}) = ${normalized}`,
          eq(adminInvitations.status, "pending"),
        ),
      );
    const [row] = await tx
      .insert(adminInvitations)
      .values({
        email: normalized,
        role,
        invitedBy,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlMs),
      })
      .returning();
    return row;
  });
  if (!invitation) throw new Error("Invitation not created");
  return { token, url: invitationUrl(token), invitation };
}

/** Pending, unexpired invitation, or `undefined`. */
export async function findPendingInvitation(db: Database, token: string) {
  const [row] = await db
    .select()
    .from(adminInvitations)
    .where(
      and(
        eq(adminInvitations.tokenHash, hashToken(token)),
        eq(adminInvitations.status, "pending"),
        gt(adminInvitations.expiresAt, sql`now()`),
      ),
    );
  return row;
}

export interface AcceptedInvitation {
  userId: string;
  email: string;
  invitationId: string;
  role: string;
}

export type AcceptResult =
  | ({ ok: true } & AcceptedInvitation)
  | { ok: false; reason: "invalid" | "already_admin" | "weak_password" };

/**
 * Accepts the invitation: creates the admin account with an already verified e-mail
 * and the chosen password. The invitation is "reserved" with a conditional UPDATE
 * before creating the account, so the same link never creates two accounts even
 * with simultaneous clicks.
 */
export async function acceptAdminInvitation(
  db: Database,
  auth: AdminAuth,
  { token, name, password }: { token: string; name: string; password: string },
  {
    onAccepted,
  }: {
    /** Runs before the acceptance counts (the audit): if it fails, everything is undone. */
    onAccepted?: (accepted: AcceptedInvitation) => Promise<void>;
  } = {},
): Promise<AcceptResult> {
  if (password.length < PASSWORD_LIMITS.admin.min || password.length > PASSWORD_LIMITS.admin.max) {
    return { ok: false, reason: "weak_password" };
  }

  const [claimed] = await db
    .update(adminInvitations)
    .set({ status: "accepted", acceptedAt: sql`now()` })
    .where(
      and(
        eq(adminInvitations.tokenHash, hashToken(token)),
        eq(adminInvitations.status, "pending"),
        gt(adminInvitations.expiresAt, sql`now()`),
      ),
    )
    .returning();
  if (!claimed) return { ok: false, reason: "invalid" };

  const release = () =>
    db
      .update(adminInvitations)
      .set({ status: "pending", acceptedAt: null, acceptedUserId: null })
      .where(eq(adminInvitations.id, claimed.id));

  const [existing] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${claimed.email.toLowerCase()}`);
  if (existing) {
    await db
      .update(adminInvitations)
      .set({ status: "revoked" })
      .where(eq(adminInvitations.id, claimed.id));
    return { ok: false, reason: "already_admin" };
  }

  // Better Auth creates the account through its own connection (outside any
  // transaction of ours): if something fails afterwards, the created account is
  // undone before releasing the invitation, otherwise an admin without a password
  // would be left over and the invitation would be revoked.
  let createdUserId: string | undefined;
  try {
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser(
      {
        email: claimed.email,
        name: name.trim(),
        emailVerified: true,
        role: claimed.role,
      },
      { method: "admin" },
    );
    createdUserId = user.id;
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await ctx.password.hash(password),
    });
    await db
      .update(adminInvitations)
      .set({ acceptedUserId: user.id })
      .where(eq(adminInvitations.id, claimed.id));
    const accepted: AcceptedInvitation = {
      userId: user.id,
      email: claimed.email,
      invitationId: claimed.id,
      role: claimed.role,
    };
    await onAccepted?.(accepted);
    return { ok: true, ...accepted };
  } catch (error) {
    // The invitation first: it points at the account and would block deleting it.
    await release();
    if (createdUserId) await db.delete(adminUsers).where(eq(adminUsers.id, createdUserId));
    throw error;
  }
}
