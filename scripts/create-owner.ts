/**
 * Creates a panel owner's invitation (there is no default password).
 * Prints a single-use link, valid for `OWNER_BOOTSTRAP_TTL_MS`.
 *
 *   Dev:        pnpm admin:create-owner owner@example.com
 *   Production: docker exec -it <app-container> node create-owner.mjs owner@example.com
 *
 * Up to three owners, counting pending owner invitations; a fourth is refused. With --force
 * and the e-mail of an existing owner (who lost their 2FA and backup codes), that account is
 * locked (sessions ended, 2FA removed, audited) and the invitation brings it back with a new
 * password and 2FA again. An admin or reader is never promoted here.
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { decideOwnerCommand } from "@/features/auth/domain/owner-seats";
import {
  createAdminInvitation,
  OWNER_BOOTSTRAP_TTL_MS,
} from "@/features/auth/server/admin-invitations.server";
import { startOwnerRecovery } from "@/features/auth/server/owner-recovery.server";
import { ownerSeatsTaken, panelRoleOfEmail } from "@/features/auth/server/owner-seats.server";
import { openDb } from "./open-db";

const args = process.argv.slice(2);
const force = args.includes("--force");
const email = z.email().safeParse(args.find((arg) => !arg.startsWith("--")));

if (!email.success) {
  console.error("Usage: create-owner <email> [--force]");
  process.exit(1);
}

const db = openDb();

// Reserve the seat in the same transaction as the check. Concurrent CLI processes
// must not both observe the last free seat. Nested transactions use savepoints.
const result = await db.transaction(async (tx) => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('admin-owner-seats'))`);
  const command = decideOwnerCommand({
    roleOfEmail: await panelRoleOfEmail(tx, email.data),
    seatsTaken: await ownerSeatsTaken(tx),
    force,
  });
  if (command.kind === "refuse") return command;
  if (command.kind === "recover") {
    const recovery = await startOwnerRecovery(tx, email.data);
    if (!recovery) throw new Error("Owner disappeared during recovery");
    return { kind: "recover" as const, ...recovery };
  }
  const invitation = await createAdminInvitation(tx, {
    email: email.data,
    role: "owner",
    invitedBy: null,
    ttlMs: OWNER_BOOTSTRAP_TTL_MS,
  });
  return { kind: "invite" as const, ...invitation };
});

if (result.kind === "refuse") {
  console.error(result.message);
  process.exit(1);
}
if (result.kind === "recover") {
  console.info(
    `\nAccess recovery for ${result.invitation.email}: the account is locked, its sessions ended and its 2FA removed.\nSingle-use link, valid for ${OWNER_BOOTSTRAP_TTL_MS / 60_000} minutes:\n\n  ${result.url}\n`,
  );
  console.info("Open the link, set a new password, and set up two-factor verification again.\n");
  process.exit(0);
}

const { url, invitation } = result;

console.info(
  `\nOwner invitation for ${invitation.email} (valid for ${OWNER_BOOTSTRAP_TTL_MS / 60_000} minutes, single use):\n\n  ${url}\n`,
);
console.info("Open the link, set a name and password, and set up two-factor verification.\n");
process.exit(0);
