import { formatFriendCode, parseFriendCode } from "@/features/friends/domain/friend-code";
import { parseRoomInput, type RoomInput } from "@/features/room/domain/room-input";

/** What the home bar holds: a room (or nothing, or not a room), or a friend's code. */
export type BarInput = RoomInput | { kind: "friend"; code: string };

/** Only with the NELC prefix: a bare "4K7Q" could just as well be a room code. */
const FRIEND_PREFIX = /^nelc[\s-]?/i;

/**
 * Reads the bar. A friend code ("NELC-T5U6") counts only when the person can add friends
 * (signed in); otherwise everything is read as a room, as before.
 */
export function parseBarInput(raw: string, { friends }: { friends: boolean }): BarInput {
  const text = raw.trim();
  if (friends && FRIEND_PREFIX.test(text)) {
    const code = parseFriendCode(text);
    if (code) return { kind: "friend", code: formatFriendCode(code) };
  }
  return parseRoomInput(raw);
}
