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

const command = decideOwnerCommand({
  roleOfEmail: await panelRoleOfEmail(db, email.data),
  seatsTaken: await ownerSeatsTaken(db),
  force,
});

if (command.kind === "refuse") {
  console.error(command.message);
  process.exit(1);
}

const recovery = command.kind === "recover" ? await startOwnerRecovery(db, email.data) : null;
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
