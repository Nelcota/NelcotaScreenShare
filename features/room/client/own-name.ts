import type { LocalParticipant } from "livekit-client";

/**
 * Shows a name on your own participant right away, before the server's update arrives.
 * LiveKit only exposes this as a private setter (the public one needs
 * canUpdateOwnMetadata), so it is reached by name and skipped if it ever disappears.
 */
export function showOwnName(participant: LocalParticipant, name: string) {
  const setName: unknown = Reflect.get(participant, "_setName");
  if (typeof setName !== "function") return;
  Reflect.apply(setName, participant, [name]);
}
