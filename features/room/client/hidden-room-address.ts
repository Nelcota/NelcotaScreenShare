import { roomCodeSchema, roomLink } from "@/features/room/domain/room-code";
import { INVITE_TOKEN_PATTERN } from "@/features/room/domain/invite-token";

/** What the address bar shows in streamer mode: no room code to read on stream. */
export const HIDDEN_ROOM_PATH = "/sala";

const STATE_KEY = "nelcotaHiddenRoom";

/** Each history entry keeps its own room, including when sessionStorage is unavailable. */
export function roomAddressState(state: unknown, code: string, invite?: string) {
  const previous = state !== null && typeof state === "object" ? state : {};
  return { ...previous, [STATE_KEY]: { code, invite } };
}

/** Reloads serve `/sala`; the router's per-entry state still identifies the actual room. */
export function rememberedRoomAddress(): string | undefined {
  const history: unknown = window.history.state;
  if (!history || typeof history !== "object" || !("usr" in history)) return undefined;
  const state = history.usr;
  if (!state || typeof state !== "object" || !(STATE_KEY in state)) return undefined;
  return roomAddressFrom(state[STATE_KEY]);
}

function roomAddressFrom(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const code = roomCodeSchema.safeParse("code" in value ? value.code : undefined);
  if (!code.success) return undefined;
  const invite = "invite" in value ? value.invite : undefined;
  const validInvite =
    typeof invite === "string" && INVITE_TOKEN_PATTERN.test(invite) ? invite : undefined;
  return roomLink(code.data, validInvite);
}
