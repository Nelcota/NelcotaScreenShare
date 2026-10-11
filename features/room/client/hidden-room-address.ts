import { roomCodeSchema, roomLink } from "@/features/room/domain/room-code";
import { INVITE_TOKEN_PATTERN } from "@/features/room/domain/invite-token";
import { logBrowserWarning } from "@/lib/telemetry.client";

/** What the address bar shows in streamer mode: no room code to read on stream. */
export const HIDDEN_ROOM_PATH = "/sala";

const STORAGE_KEY = "nelcota:sala-oculta";

/** Only this tab: a reload under `/sala` finds the room again; other tabs never see it. */
export function rememberRoomAddress(code: string, invite?: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ code, invite }));
  } catch (error) {
    logBrowserWarning("Could not remember the hidden room address", error);
  }
}

/** The room behind `/sala` in this tab, validated again (storage is editable by the page). */
export function rememberedRoomAddress(): string | undefined {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return undefined;
    return roomAddressFrom(JSON.parse(saved));
  } catch (error) {
    logBrowserWarning("Could not read the hidden room address", error);
    return undefined;
  }
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
