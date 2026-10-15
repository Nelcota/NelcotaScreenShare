import { beforeEach, afterAll, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "@/server/db/index.server";
import { roomSessions } from "@/server/db/schema/room-control";
import { rooms, roomParticipations, shareSessions } from "@/server/db/schema/rooms";
import { ingestEvent } from "@/features/room/server/webhook/projector.server";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { personalData } from "@/features/account/server/personal-data.server";
import { anonymizeParticipant } from "@/features/account/server/participant-accounts.server";
import { controlledRoom, grant, mockControlTransport } from "./support/host-controls";

process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

test("internal media names map to public history and session; metadata never changes host", async () => {
  const room = await controlledRoom();
  const now = Math.floor(Date.now() / 1000);
  const result = await ingestEvent(getDb(), crypto.randomUUID(), {
    event: "participant_joined",
    createdAt: now,
    room: { name: room.mediaRoomName, sid: "RM_controlled" },
    participant: {
      sid: "PA_controlled",
      identity: room.other,
      name: "Pessoa",
      joinedAt: now,
      metadata: '{"host":true}',
    },
  });
  expect(result).toBe("projected");
  const [history] = await getDb().select().from(rooms).where(eq(rooms.code, room.code));
  const [entry] = await getDb()
    .select()
    .from(roomParticipations)
    .where(eq(roomParticipations.livekitSid, "PA_controlled"));
  expect(history?.code).toBe(room.code);
  expect(entry?.sessionId).toBe(room.sessionId);
  const [session] = await getDb()
    .select()
    .from(roomSessions)
    .where(eq(roomSessions.id, room.sessionId));
  expect(session?.hostUserId).toBe(room.host);
  const data = await personalData(getDb(), room.host);
  expect(data.salas_permanentes.some((definition) => definition.sala === room.code)).toBe(true);
  expect(data.admissoes_em_chamadas.some((member) => member.chamada === room.sessionId)).toBe(true);
  await getDb().transaction((tx) => anonymizeParticipant(tx, room.host));
  const [detached] = await getDb()
    .select()
    .from(roomSessions)
    .where(eq(roomSessions.id, room.sessionId));
  expect(detached?.hostUserId).toBeNull();
});

test("late close of an earlier media session cannot finish or close tracks in the current call", async () => {
  const db = getDb();
  const room = await controlledRoom();
  const now = Math.floor(Date.now() / 1000);
  const event = (name: string, sid: string, kind: string, seconds: number, extra: object = {}) =>
    ingestEvent(db, crypto.randomUUID(), {
      event: kind,
      createdAt: seconds,
      room: { name, sid, creationTime: seconds },
      ...extra,
    });
  await event(room.mediaRoomName, "RM_old", "room_started", now);
  await db
    .update(roomSessions)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(roomSessions.id, room.sessionId));
  const next = await reserveAdmission(db, grant(room.code, room.host), 6);
  // An old media room can finish later even if its delivery arrives before the new start.
  await event(room.mediaRoomName, "RM_old", "room_finished", now + 20);
  await event(next.mediaRoomName, "RM_new", "room_started", now + 10);
  const person = { identity: room.host, sid: "PA_new", name: "Pessoa", joinedAt: now + 10 };
  await event(next.mediaRoomName, "RM_new", "track_published", now + 11, {
    participant: person,
    track: { sid: "TR_new", source: "SCREEN_SHARE" },
  });
  await event(room.mediaRoomName, "RM_old", "room_finished", now + 20);
  const [history] = await db.select().from(rooms).where(eq(rooms.code, room.code));
  expect(history?.status).toBe("active");
  expect(history?.livekitSid).toBe("RM_new");
  const [share] = await db.select().from(shareSessions).where(eq(shareSessions.trackSid, "TR_new"));
  expect(share?.endedAt).toBeNull();
});
