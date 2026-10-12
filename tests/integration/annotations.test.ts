import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { TrackInfo, TrackSource } from "livekit-server-sdk";
import { closeDb, getDb } from "@/server/db/index.server";
import { roomSessionMembers } from "@/server/db/schema/room-control";
import { annotationRequest } from "@/features/room/server/annotations.server";
import { roomService } from "@/features/room/server/room-service.server";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { annotationStateSchema } from "@/features/room/domain/annotations";
import {
  controlledRoom,
  mockControlTransport,
  online,
  participant,
  grant,
} from "./support/host-controls";

const auth = vi.hoisted(() => ({ identity: "", kind: "account" as "account" | "guest" }));
vi.mock("@/features/room/server/room-caller.server", () => ({
  roomCaller: async () => (auth.identity ? { ...auth } : undefined),
}));
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(() => {
  mockControlTransport();
  vi.spyOn(roomService(), "sendData").mockResolvedValue();
  auth.identity = "";
  auth.kind = "account";
});
afterAll(closeDb);

function request(
  room: { code: string; sessionId: string },
  clearing = false,
  trackSid = "TR_screen",
) {
  const input = { room: room.code, sessionId: room.sessionId, trackSid };
  return new Request(
    `http://localhost:3000/api/sala/anotacoes?${new URLSearchParams(input)}`,
    clearing
      ? {
          method: "POST",
          headers: { origin: "http://localhost:3000", "content-type": "application/json" },
          body: JSON.stringify(input),
        }
      : undefined,
  );
}
test("server-authorized epochs allow host or presenter clearing, reject ordinary and excluded viewers", async () => {
  const room = await controlledRoom();
  const [host, presenter] = online.get(room.mediaRoomName) ?? [];
  if (!host || !presenter) throw new Error("Participants missing");
  presenter.tracks = [
    new TrackInfo({ sid: "TR_screen", source: TrackSource.SCREEN_SHARE, width: 1280, height: 720 }),
  ];
  auth.identity = room.other;
  const original = annotationStateSchema.parse(
    await (await annotationRequest(request(room))).json(),
  );
  expect(original.canClear).toBe(true);
  const cleared = annotationStateSchema.parse(
    await (await annotationRequest(request(room, true))).json(),
  );
  expect(cleared.epoch).not.toBe(original.epoch);
  expect(cleared.revision).toBe(original.revision + 1);
  auth.identity = room.host;
  expect((await annotationRequest(request(room, true))).status).toBe(200);
  auth.identity = "convidado-reader";
  auth.kind = "guest";
  await reserveAdmission(getDb(), grant(room.code, auth.identity), 6);
  await getDb()
    .update(roomSessionMembers)
    .set({ admittedAt: new Date() })
    .where(eq(roomSessionMembers.identity, auth.identity));
  online.get(room.mediaRoomName)?.push(participant(auth.identity, 3));
  expect((await annotationRequest(request(room))).status).toBe(200);
  expect((await annotationRequest(request(room, true))).status).toBe(403);
  auth.identity = room.other;
  auth.kind = "account";
  await room.command({ kind: "remove", identity: room.other });
  expect((await annotationRequest(request(room, true))).status).toBe(403);
});
test("a signed guest presenter can clear; canonical dimensions rotate the epoch and stale tracks fail", async () => {
  const room = await controlledRoom();
  auth.identity = "convidado-presenter";
  auth.kind = "guest";
  await reserveAdmission(getDb(), grant(room.code, auth.identity), 6);
  await getDb()
    .update(roomSessionMembers)
    .set({ admittedAt: new Date() })
    .where(eq(roomSessionMembers.identity, auth.identity));
  const guest = participant(auth.identity, 3);
  const screen = new TrackInfo({
    sid: "TR_screen",
    source: TrackSource.SCREEN_SHARE,
    width: 1280,
    height: 720,
  });
  guest.tracks = [screen];
  online.get(room.mediaRoomName)?.push(guest);
  const state = annotationStateSchema.parse(
    await (await annotationRequest(request(room, true))).json(),
  );
  screen.width = 1920;
  const resized = annotationStateSchema.parse(
    await (await annotationRequest(request(room))).json(),
  );
  expect(resized.epoch).not.toBe(state.epoch);
  expect(resized.revision).toBe(state.revision + 1);
  expect((await annotationRequest(request(room, true, "TR_old"))).status).toBe(403);
  const otherRoom = await controlledRoom();
  expect((await annotationRequest(request({ ...room, code: otherRoom.code }))).status).toBe(403);
  expect(
    (
      await annotationRequest(
        new Request("http://localhost:3000/api/sala/anotacoes", {
          method: "POST",
          headers: { origin: "https://foreign.example" },
          body: JSON.stringify({
            room: room.code,
            sessionId: room.sessionId,
            trackSid: "TR_screen",
          }),
        }),
      )
    ).status,
  ).toBe(403);
});
