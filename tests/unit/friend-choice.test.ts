import { describe, expect, test } from "vitest";
import type { FriendStatus } from "@/features/friends/domain/friend-lists";
import { friendsToCall } from "@/features/ringing/domain/friend-choice";

function friend(id: string, status: FriendStatus["status"]): FriendStatus {
  return { id, name: id, status };
}

describe("the friends a call goes to", () => {
  test("leaves out someone chosen who went Não perturbe meanwhile", () => {
    // Bia was Online when she was chosen; the call used to ring her anyway.
    const friends = [friend("ana", "online"), friend("bia", "busy"), friend("caio", "away")];

    const called = friendsToCall(friends, new Set(["ana", "bia", "caio"]));

    expect(called).toEqual(["ana", "caio"]);
  });
});
