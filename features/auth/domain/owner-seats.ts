import type { AdminRole } from "@/features/auth/domain/roles";

/** How many panel owners there can be, counting owner invitations still pending. */
export const MAX_OWNERS = 3;

export type OwnerCommand =
  | { kind: "invite" }
  | { kind: "recover" }
  | { kind: "refuse"; message: string };

export interface OwnerCommandState {
  /** The panel role already tied to the e-mail, or null when it has no panel account. */
  roleOfEmail: AdminRole | null;
  /** Owner accounts plus pending owner invitations. */
  seatsTaken: number;
  force: boolean;
}

/**
 * What `create-owner` does for an e-mail. A new owner only while a seat is free; `--force`
 * only brings back someone who already is an owner, so recovery never promotes an admin.
 */
export function decideOwnerCommand(state: OwnerCommandState): OwnerCommand {
  if (state.roleOfEmail === "owner" && state.force) return { kind: "recover" };
  if (state.roleOfEmail === "owner") {
    return {
      kind: "refuse",
      message: "This e-mail is already an owner. To recover access, run again with --force.",
    };
  }
  if (state.roleOfEmail !== null) {
    return {
      kind: "refuse",
      message: "This e-mail is already on the panel team. Owners are not promoted from here.",
    };
  }
  if (state.seatsTaken >= MAX_OWNERS) {
    return {
      kind: "refuse",
      message: `The panel already has ${MAX_OWNERS} owners (or pending owner invitations). Invite admins from the panel.`,
    };
  }
  return { kind: "invite" };
}
