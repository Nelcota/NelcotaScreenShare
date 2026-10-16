/**
 * Creates the invitation for the panel's first owner (there is no default password).
 * Prints a single-use link, valid for `OWNER_BOOTSTRAP_TTL_MS`.
 *
 *   Dev:        pnpm admin:create-owner owner@example.com
 *   Production: docker exec -it <app-container> node create-owner.mjs owner@example.com
 *
 * Refuses if an active owner already exists (use --force only to recover access,
 * for example when the only owner lost their 2FA and backup codes). With --force and an
 * e-mail that already has panel access, that account is locked (sessions ended, 2FA
 * removed, audited) and the invitation brings it back with a new password and 2FA again.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  createAdminInvitation,
  OWNER_BOOTSTRAP_TTL_MS,
} from "@/features/auth/server/admin-invitations.server";
import { startOwnerRecovery } from "@/features/auth/server/owner-recovery.server";
import { adminUsers } from "@/server/db/schema";
import { openDb } from "./open-db";

const args = process.argv.slice(2);
const force = args.includes("--force");
const email = z.email().safeParse(args.find((arg) => !arg.startsWith("--")));

if (!email.success) {
  console.error("Usage: create-owner <email> [--force]");
  process.exit(1);
}

const db = openDb();

const owners = await db
  .select({ id: adminUsers.id })
  .from(adminUsers)
  .where(and(eq(adminUsers.role, "owner"), eq(adminUsers.banned, false)));

if (owners.length > 0 && !force) {
  console.error(
    "An active owner already exists. Invite new admins from the panel. To recover access, run again with --force.",
  );
  process.exit(1);
}

const recovery = force ? await startOwnerRecovery(db, email.data) : null;
if (recovery) {
  console.info(
    `\nAccess recovery for ${recovery.invitation.email}: the account is locked, its sessions ended and its 2FA removed.\nSingle-use link, valid for ${OWNER_BOOTSTRAP_TTL_MS / 60_000} minutes:\n\n  ${recovery.url}\n`,
  );
  console.info("Open the link, set a new password, and set up two-factor verification again.\n");
  process.exit(0);
}

const { url, invitation } = await createAdminInvitation(db, {
  email: email.data,
  role: "owner",
  invitedBy: null,
  ttlMs: OWNER_BOOTSTRAP_TTL_MS,
});

console.info(
  `\nOwner invitation for ${invitation.email} (valid for ${OWNER_BOOTSTRAP_TTL_MS / 60_000} minutes, single use):\n\n  ${url}\n`,
);
console.info("Open the link, set a name and password, and set up two-factor verification.\n");
process.exit(0);
