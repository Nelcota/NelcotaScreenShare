import { expect, test } from "vitest";
import {
  canAnswer,
  decideFriendRequest,
  friendPair,
  MAX_FRIENDS,
  MAX_PENDING_SENT,
  type FriendRequestState,
} from "@/features/friends/domain/friendship";

const ANA = "0199c6f0-0000-7000-8000-00000000000a";
const BIA = "0199c6f0-0000-7000-8000-00000000000b";

function request(overrides: Partial<FriendRequestState> = {}): FriendRequestState {
  return {
    requesterId: ANA,
    targetId: BIA,
    existing: null,
    blocked: "none",
    requesterFriends: 0,
    targetFriends: 0,
    requesterPendingSent: 0,
    ...overrides,
  };
}

test("the pair is stored in id order, whoever asks", () => {
  expect(friendPair(BIA, ANA)).toEqual({ userLowId: ANA, userHighId: BIA });
  expect(friendPair(ANA, BIA)).toEqual({ userLowId: ANA, userHighId: BIA });
});

test("a new request is created, and a crossed one accepts the other's", () => {
  expect(decideFriendRequest(request())).toBe("create");
  const theirs = { status: "pending" as const, requestedBy: BIA };
  expect(decideFriendRequest(request({ existing: theirs }))).toBe("accept");
});

test("repeating a request or asking a friend changes nothing", () => {
  const mine = { status: "pending" as const, requestedBy: ANA };
  expect(decideFriendRequest(request({ existing: mine }))).toBe("already_sent");
  const friends = { status: "accepted" as const, requestedBy: BIA };
  expect(decideFriendRequest(request({ existing: friends }))).toBe("already_friends");
});

test("a block is ignored before anything else, and asking oneself is refused", () => {
  const friends = { status: "accepted" as const, requestedBy: BIA };
  expect(decideFriendRequest(request({ blocked: "by_requester", existing: friends }))).toBe(
    "ignored",
  );
  // Blocked by the target: a request only the requester sees, so the block stays hidden.
  expect(decideFriendRequest(request({ blocked: "by_target" }))).toBe("hidden");
  const mine = { status: "pending" as const, requestedBy: ANA, dismissed: true };
  expect(decideFriendRequest(request({ blocked: "by_target", existing: mine }))).toBe("ignored");
  expect(decideFriendRequest(request({ targetId: ANA }))).toBe("self");
});

test("the friend limit counts both sides, and too many waiting requests stop new ones", () => {
  expect(decideFriendRequest(request({ requesterFriends: MAX_FRIENDS }))).toBe("friend_limit");
  expect(decideFriendRequest(request({ targetFriends: MAX_FRIENDS }))).toBe("friend_limit");
  expect(decideFriendRequest(request({ requesterPendingSent: MAX_PENDING_SENT }))).toBe(
    "pending_limit",
  );
  const theirs = { status: "pending" as const, requestedBy: BIA };
  expect(
    decideFriendRequest(request({ existing: theirs, requesterPendingSent: MAX_PENDING_SENT })),
  ).toBe("accept");
});

test("only the person who received a pending request answers it", () => {
  const pending = { status: "pending" as const, requestedBy: ANA };
  expect(canAnswer(pending, BIA)).toBe(true);
  expect(canAnswer(pending, ANA)).toBe(false);
  expect(canAnswer({ status: "accepted", requestedBy: ANA }, BIA)).toBe(false);
  expect(canAnswer(null, BIA)).toBe(false);
  // Declined or hidden requests are not answered again.
  expect(canAnswer({ ...pending, dismissed: true }, BIA)).toBe(false);
});
