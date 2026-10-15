import assert from "node:assert/strict";
import { test } from "vitest";
import { GHOST_GRACE_MS, ghostRoomIds } from "@/features/admin/live/domain/ghost-rooms";
import { liveKitRoomNames } from "@/features/admin/live/server/livekit-rooms.server";

const now = Date.parse("2026-10-11T12:00:00Z");
const quiet = new Date(now - GHOST_GRACE_MS - 1);

test("a live room LiveKit no longer has is a ghost, after a grace period", () => {
  const rooms = [
    { id: "a", code: "aberta", lastActivityAt: quiet },
    { id: "b", code: "fantasma", lastActivityAt: quiet },
    // Just created: LiveKit's list may not have it yet.
    { id: "c", code: "recem-criada", lastActivityAt: new Date(now - 1000) },
  ];
  assert.deepEqual([...ghostRoomIds(rooms, new Set(["aberta"]), now)], ["b"]);
});

test("without LiveKit's answer no room is called a ghost", async () => {
  const rooms = [{ id: "b", code: "fantasma", lastActivityAt: quiet }];
  assert.equal(ghostRoomIds(rooms, null, now).size, 0);

  const unavailable = await liveKitRoomNames(async () => {
    throw new Error("connect ECONNREFUSED");
  });
  assert.equal(unavailable, null);
  assert.deepEqual(await liveKitRoomNames(async () => ["sala-1"]), new Set(["sala-1"]));
});
