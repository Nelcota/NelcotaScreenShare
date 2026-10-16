import { eq, sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit.server";
import type { Database } from "@/server/db/index.server";
import { adminUsers } from "@/server/db/schema";

/**
 * The audit log keeps what an admin should look into: a panel account that got locked.
 * Each wrong password already lives in `login_failures` (the lockout counts from there);
 * writing it here too let anyone grow the immutable table without limit, with any e-mail.
 * So: one row when a lockout starts, only for an e-mail that is an admin, tied to it.
 */
export async function recordAdminLockout(
  db: Database,
  { email, hash, retryAfterSeconds }: { email: string; hash: string; retryAfterSeconds: number },
) {
  const [admin] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(sql`lower(${adminUsers.email})`, email.trim().toLowerCase()));
  if (!admin) return;
  await recordAudit(db, "system", {
    action: "auth.lockout",
    resourceType: "admin_user",
    resourceId: admin.id,
    // Only part of the HMAC: ties lockouts together without storing the e-mail.
    metadata: { email_hash: hash.slice(0, 16), minutos: Math.ceil(retryAfterSeconds / 60) },
  });
}
