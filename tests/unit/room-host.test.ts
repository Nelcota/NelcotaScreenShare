import { expect, test } from "vitest";
import {
  canRunHostCommand,
  closeEndsRoom,
  electionOrder,
  hostCommandsFor,
  ownerTakingOver,
} from "@/features/room/domain/room-host";

test("the host and the owner give every command", () => {
  const all = ["lock", "sharing", "remove", "transfer", "close"];
  expect(hostCommandsFor({ isHost: true, role: "participant" })).toEqual(all);
  expect(hostCommandsFor({ isHost: false, role: "owner" })).toEqual(all);
});

test("a moderator is a co-host: lock, sharing and removal, not transfer or close", () => {
  const moderator = { isHost: false, role: "moderator" as const };
  expect(canRunHostCommand(moderator, "lock")).toBe(true);
  expect(canRunHostCommand(moderator, "sharing")).toBe(true);
  expect(canRunHostCommand(moderator, "remove")).toBe(true);
  expect(canRunHostCommand(moderator, "transfer")).toBe(false);
  expect(canRunHostCommand(moderator, "close")).toBe(false);
});

test("a participant who is not the host gives no command", () => {
  expect(hostCommandsFor({ isHost: false, role: "participant" })).toEqual([]);
});

test("the election puts the owner first, then moderators, then the oldest account", () => {
  const order = electionOrder([
    { identity: "c", role: "participant", joinedAt: 1n },
    { identity: "b", role: "moderator", joinedAt: 5n },
    { identity: "a", role: "moderator", joinedAt: 3n },
    { identity: "d", role: "owner", joinedAt: 9n },
  ]);
  expect(order.map((candidate) => candidate.identity)).toEqual(["d", "a", "b", "c"]);
});

test("the owner in the call takes the host over; otherwise the host stays", () => {
  const owner = { identity: "ana", role: "owner" as const, joinedAt: 2n };
  const guest = { identity: "bia", role: "participant" as const, joinedAt: 1n };
  expect(ownerTakingOver("bia", [guest, owner])).toBe("ana");
  expect(ownerTakingOver("ana", [guest, owner])).toBeUndefined();
  expect(ownerTakingOver("bia", [guest])).toBeUndefined();
});

test("ending the call closes only an ad hoc room nobody owns", () => {
  expect(closeEndsRoom({ kind: "ad_hoc", hasOwner: false })).toBe(true);
  expect(closeEndsRoom({ kind: "ad_hoc", hasOwner: true })).toBe(false);
  expect(closeEndsRoom({ kind: "personal", hasOwner: false })).toBe(false);
  expect(closeEndsRoom({ kind: "team", hasOwner: true })).toBe(false);
});
