import { describe, expect, test } from "vitest";
import { requestNudgeTargets } from "@/features/friends/domain/friend-nudges";

describe("who reloads after a friend request", () => {
  test("the target hears about a new request or a friendship", () => {
    expect(requestNudgeTargets("ana", "bia", "create")).toEqual(["ana", "bia"]);
    expect(requestNudgeTargets("ana", "bia", "accept")).toEqual(["ana", "bia"]);
  });

  test("a hidden request or an unknown e-mail only reloads the requester", () => {
    expect(requestNudgeTargets("ana", "bia", "hidden")).toEqual(["ana"]);
    expect(requestNudgeTargets("ana", "bia", "already_sent")).toEqual(["ana"]);
    expect(requestNudgeTargets("ana", undefined, "ignored")).toEqual(["ana"]);
  });
});
