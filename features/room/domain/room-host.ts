import type { z } from "zod";
import type { hostCommandKindSchema } from "./host-controls";
import type { RoomRole } from "./room-role";

/**
 * How the room's saved roles meet the call's host (docs/adr/0007-room-ownership-and-host.md):
 * the owner hosts when present, a moderator is a co-host, and the host controls do the rest.
 */
export type HostCommandKind = z.infer<typeof hostCommandKindSchema>;

const ALL_COMMANDS: readonly HostCommandKind[] = ["lock", "sharing", "remove", "transfer", "close"];
/** A moderator runs the call alongside the host, but cannot hand it over or end it. */
const CO_HOST_COMMANDS: readonly HostCommandKind[] = ["lock", "sharing", "remove"];

/** Commands someone may give in this call: all for the host or the owner, some for a moderator. */
export function hostCommandsFor({
  isHost,
  role,
}: {
  isHost: boolean;
  role: RoomRole;
}): readonly HostCommandKind[] {
  if (isHost || role === "owner") return ALL_COMMANDS;
  if (role === "moderator") return CO_HOST_COMMANDS;
  return [];
}

export function canRunHostCommand(
  actor: { isHost: boolean; role: RoomRole },
  kind: HostCommandKind,
): boolean {
  return hostCommandsFor(actor).includes(kind);
}

/** Someone who could take over as host, as seen in the call. */
export interface HostCandidate {
  identity: string;
  role: RoomRole;
  /** When they joined the call, from LiveKit. */
  joinedAt: bigint;
}

const ELECTION_RANK: Record<RoomRole, number> = { owner: 0, moderator: 1, participant: 2 };

/** Who takes over first: the owner, then the oldest moderator, then the oldest account. */
export function electionOrder(candidates: readonly HostCandidate[]): HostCandidate[] {
  return candidates.toSorted(
    (a, b) =>
      ELECTION_RANK[a.role] - ELECTION_RANK[b.role] ||
      Number(a.joinedAt - b.joinedAt) ||
      a.identity.localeCompare(b.identity),
  );
}

/**
 * The owner in the call becomes its host, whoever had it; `undefined` keeps the current one.
 * An owner who handed the host over (`givenAt`) takes it back only after joining again.
 */
export function ownerTakingOver(
  currentHost: string | null,
  candidates: readonly HostCandidate[],
  givenAt: Date | null = null,
): string | undefined {
  const owner = candidates.find((candidate) => candidate.role === "owner");
  if (!owner || owner.identity === currentHost) return undefined;
  if (givenAt && !joinedSince(owner, givenAt)) return undefined;
  return owner.identity;
}

/** LiveKit counts `joinedAt` in seconds; a join in the same second counts as after. */
function joinedSince(candidate: HostCandidate, moment: Date): boolean {
  return candidate.joinedAt >= BigInt(Math.floor(moment.getTime() / 1000));
}

/**
 * Ending the call also closes the room only when nobody owns it: a room from "Criar sala"
 * keeps its owner and moderators for the next call.
 */
export function closeEndsRoom({
  kind,
  hasOwner,
}: {
  kind: "ad_hoc" | "personal" | "team";
  hasOwner: boolean;
}): boolean {
  return kind === "ad_hoc" && !hasOwner;
}
