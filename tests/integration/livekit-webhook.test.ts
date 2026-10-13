import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { AccessToken } from "livekit-server-sdk";
import { Pool } from "pg";
import { afterAll, describe, test } from "vitest";
import { z } from "zod";
import { receiveLivekitWebhook } from "@/features/room/server/webhook/route.server";
import * as schema from "@/server/db/schema";
import { reprocessPendingEvents } from "@/features/room/server/webhook/projector.server";
import { anonymizeParticipant } from "@/features/account/server/participant-accounts.server";
import { reconcileShareAudio } from "@/features/room/server/webhook/share-audio.server";

/**
 * LiveKit webhook end to end: events signed the way LiveKit sends them
 * (protobuf JSON), stored and projected into Postgres.
 */
const { LIVEKIT_API_KEY: KEY, LIVEKIT_API_SECRET: SECRET } = process.env;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

/** 2026-10-06 around 12:00 UTC, in seconds. */
const T = 1_791_300_000;
let eventCounter = 0;
let roomCounter = 0;

function newRoom() {
  roomCounter += 1;
  return `sala-${roomCounter}-${Date.now().toString(36)}`;
}

async function newUser(name: string) {
  const [user] = await db
    .insert(schema.users)
    .values({ name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(user);
  return user.id;
}

interface EventInput {
  event: string;
  room: string;
  at: number;
  participant?: {
    identity: string;
    name?: string;
    joinedAt?: number;
    reason?: string;
    sid?: string;
  };
  track?: { sid: string; source: string };
  id?: string;
  roomSid?: string;
}

type TrackDelivery = { event: string; at: number; sid: string; source: string };

function payload({ event, room, at, participant, track, id, roomSid }: EventInput) {
  eventCounter += 1;
  return JSON.stringify({
    id: id ?? `EV_${eventCounter}_${Date.now()}`,
    event,
    createdAt: String(at),
    room: { name: room, sid: roomSid ?? `RM_${room}`, creationTime: String(at) },
    ...(participant
      ? {
          // As LiveKit sends it: track events carry only sid and identity.
          participant: {
            sid: participant.sid ?? `PA_${participant.identity}`,
            identity: participant.identity,
            ...(participant.name ? { name: participant.name } : {}),
            ...(participant.joinedAt
              ? {
                  joinedAt: String(participant.joinedAt),
                  joinedAtMs: String(participant.joinedAt * 1000),
                }
              : {}),
            ...(participant.reason ? { disconnectReason: participant.reason } : {}),
          },
        }
      : {}),
    ...(track ? { track: { sid: track.sid, source: track.source } } : {}),
  });
}

async function send(
  input: EventInput | string,
  gateway?: Parameters<typeof receiveLivekitWebhook>[1],
) {
  const body = typeof input === "string" ? input : payload(input);
  assert.ok(KEY && SECRET, "file-setup sets the LiveKit keys");
  const token = new AccessToken(KEY, SECRET);
  token.sha256 = createHash("sha256").update(body).digest("base64");
  const response = await receiveLivekitWebhook(
    new Request("http://localhost/api/livekit/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/webhook+json",
        authorization: await token.toJwt(),
      },
      body,
    }),
    gateway,
  );
  assert.equal(response.status, 204);
}

async function roomByCode(code: string) {
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.code, code) });
  assert.ok(room, `room ${code}`);
  return room;
}

function participationsOf(roomId: string) {
  return db
    .select()
    .from(schema.roomParticipations)
    .where(eq(schema.roomParticipations.roomId, roomId))
    .orderBy(schema.roomParticipations.joinedAt);
}

describe("event projection", () => {
  test("late events cannot resurrect deleted history or corrupt a new opening of the same code", async () => {
    const code = newRoom();
    await send({ event: "room_started", room: code, at: T });
    await send({ event: "room_finished", room: code, at: T + 60 });
    const old = await roomByCode(code);
    await db
      .update(schema.rooms)
      .set({ deletedAt: new Date((T + 70) * 1000) })
      .where(eq(schema.rooms.id, old.id));
    await send({
      event: "participant_joined",
      room: code,
      at: T + 1,
      participant: { identity: "late-deleted", joinedAt: T + 1 },
    });
    assert.equal(
      (await db.select().from(schema.rooms).where(eq(schema.rooms.code, code))).length,
      1,
    );
    assert.equal((await participationsOf(old.id)).length, 0);
    const roomSid = `RM_new_${code}`;
    await send({ event: "room_started", room: code, roomSid, at: T + 100 });
    const [current] = await db
      .select()
      .from(schema.rooms)
      .where(and(eq(schema.rooms.code, code), sql`${schema.rooms.deletedAt} is null`));
    assert.ok(current);
    assert.notEqual(current.id, old.id);
    // The old SID is rejected even if its event timestamp is later than the deletion.
    await send({ event: "room_finished", room: code, at: T + 110 });
    await send({ event: "room_started", room: code, at: T });
    const latest = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, current.id) });
    assert.equal(latest?.status, "active");
    assert.equal(latest?.startedAt.getTime(), (T + 100) * 1000);
    assert.equal(latest?.livekitSid, roomSid);
  });

  test("anonymization redacts raw deliveries and concurrent or later events without losing replay data", async () => {
    const code = newRoom();
    const id = await newUser("Original");
    const participant = { identity: id, name: "Nome Original", joinedAt: T };
    await send({ event: "participant_joined", room: code, at: T, participant });
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deleting = db.transaction(async (tx) => {
      await anonymizeParticipant(tx, id);
      started?.();
      await hold;
    });
    await ready;
    const incoming = send({ event: "participant_left", room: code, at: T + 10, participant });
    release?.();
    await Promise.all([deleting, incoming]);
    await send({
      event: "participant_joined",
      room: code,
      at: T + 20,
      participant: {
        ...participant,
        sid: `PA_new_${code}`,
        joinedAt: T + 20,
      },
    });
    const events = await db
      .select()
      .from(schema.livekitEvents)
      .where(eq(schema.livekitEvents.roomName, code));
    assert.equal(events.length, 3);
    for (const event of events) {
      const raw = z.object({ participant: z.record(z.string(), z.unknown()) }).parse(event.payload);
      assert.equal(raw.participant.name, undefined);
      assert.equal(raw.participant.identity, id);
      assert.ok(raw.participant.sid);
      assert.ok(event.processedAt);
      assert.equal(event.error, null);
    }
  });
  test("audio reconciliation does not rewrite unchanged shares", async () => {
    const code = newRoom();
    const participant = { identity: `audio-write-${code}`, joinedAt: T };
    const trackSid = `TR_write_${code}`;
    await send({
      event: "track_published",
      room: code,
      at: T + 5,
      participant,
      track: { sid: trackSid, source: "SCREEN_SHARE" },
    });
    const room = await roomByCode(code);
    const readVersion = async () => {
      const [share] = await db
        .select({
          version: sql<string>`xmin::text`,
          withAudio: schema.shareSessions.withAudio,
        })
        .from(schema.shareSessions)
        .where(eq(schema.shareSessions.trackSid, trackSid));
      assert.ok(share);
      return share;
    };
    const withoutAudio = await readVersion();
    await reconcileShareAudio(db, room.id, code);
    assert.deepEqual(await readVersion(), withoutAudio);
    await send({
      event: "track_published",
      room: code,
      at: T + 6,
      participant,
      track: { sid: `TR_audio_${code}`, source: "SCREEN_SHARE_AUDIO" },
    });
    const withAudio = await readVersion();
    assert.equal(withAudio.withAudio, true);
    assert.notEqual(withAudio.version, withoutAudio.version);
    await reconcileShareAudio(db, room.id, code);
    assert.deepEqual(await readVersion(), withAudio);
  });

  test("a late room_started corrects the provisional start without moving activity backwards", async () => {
    const code = newRoom();
    await send({
      event: "participant_joined",
      room: code,
      at: T + 10,
      participant: { identity: `late-start-${code}`, joinedAt: T + 10 },
    });
    await send({ event: "room_started", room: code, at: T });
    const room = await roomByCode(code);
    assert.equal(room.startedAt.getTime(), T * 1000);
    assert.equal(room.lastActivityAt.getTime(), (T + 10) * 1000);
  });

  test("a late join preserves the peak of participants whose intervals overlap", async () => {
    const code = newRoom();
    const first = { identity: `peak-a-${code}`, joinedAt: T + 1 };
    const second = { identity: `peak-b-${code}`, joinedAt: T + 5 };
    await send({ event: "participant_joined", room: code, at: T + 1, participant: first });
    await send({ event: "participant_left", room: code, at: T + 10, participant: first });
    await send({ event: "participant_left", room: code, at: T + 15, participant: second });
    await send({ event: "participant_joined", room: code, at: T + 5, participant: second });
    assert.equal((await roomByCode(code)).peakParticipants, 2);
  });

  test("a late leave corrects an inflated peak and simultaneous leave/join do not overlap", async () => {
    const code = newRoom();
    const first = { identity: `boundary-a-${code}`, joinedAt: T + 1 };
    const second = { identity: `boundary-b-${code}`, joinedAt: T + 10 };
    await send({ event: "participant_joined", room: code, at: T + 1, participant: first });
    await send({ event: "participant_joined", room: code, at: T + 10, participant: second });
    assert.equal((await roomByCode(code)).peakParticipants, 2);
    await send({ event: "participant_left", room: code, at: T + 10, participant: first });
    assert.equal((await roomByCode(code)).peakParticipants, 1);
  });

  const audioCases: {
    name: string;
    deliveries: TrackDelivery[];
    expected: Record<string, boolean>;
  }[] = [
    {
      name: "does not carry audio into the next share without audio",
      deliveries: [
        { event: "track_published", at: 1, sid: "audio", source: "SCREEN_SHARE_AUDIO" },
        { event: "track_published", at: 2, sid: "first", source: "SCREEN_SHARE" },
        { event: "track_unpublished", at: 3, sid: "audio", source: "SCREEN_SHARE_AUDIO" },
        { event: "track_unpublished", at: 4, sid: "first", source: "SCREEN_SHARE" },
        { event: "track_published", at: 10, sid: "second", source: "SCREEN_SHARE" },
      ],
      expected: { first: true, second: false },
    },
    {
      name: "marks an ended share when its audio publication arrives after the next share",
      deliveries: [
        { event: "track_published", at: 10, sid: "first", source: "SCREEN_SHARE" },
        { event: "track_unpublished", at: 20, sid: "first", source: "SCREEN_SHARE" },
        { event: "track_published", at: 30, sid: "second", source: "SCREEN_SHARE" },
        { event: "track_published", at: 11, sid: "audio", source: "SCREEN_SHARE_AUDIO" },
      ],
      expected: { first: true, second: false },
    },
    {
      name: "reassigns audio when the earlier video arrives last",
      deliveries: [
        { event: "track_published", at: 20, sid: "second", source: "SCREEN_SHARE" },
        { event: "track_published", at: 10, sid: "audio", source: "SCREEN_SHARE_AUDIO" },
        { event: "track_unpublished", at: 15, sid: "first", source: "SCREEN_SHARE" },
        { event: "track_published", at: 10, sid: "first", source: "SCREEN_SHARE" },
      ],
      expected: { first: true, second: false },
    },
    {
      name: "does not attach audio that already ended before the video began",
      deliveries: [
        { event: "track_published", at: 1, sid: "audio", source: "SCREEN_SHARE_AUDIO" },
        { event: "track_published", at: 3, sid: "first", source: "SCREEN_SHARE" },
        { event: "track_unpublished", at: 2, sid: "audio", source: "SCREEN_SHARE_AUDIO" },
      ],
      expected: { first: false },
    },
    {
      name: "accepts audio started well after the video began",
      deliveries: [
        { event: "track_published", at: 1, sid: "first", source: "SCREEN_SHARE" },
        { event: "track_published", at: 80, sid: "audio", source: "SCREEN_SHARE_AUDIO" },
      ],
      expected: { first: true },
    },
  ];
  for (const scenario of audioCases) {
    test(scenario.name, async () => {
      const code = newRoom();
      const participant = { identity: `audio-${code}`, joinedAt: T };
      for (const delivery of scenario.deliveries) {
        await send({
          event: delivery.event,
          room: code,
          at: T + delivery.at,
          participant,
          track: { sid: `TR_${delivery.sid}_${code}`, source: delivery.source },
        });
      }
      const room = await roomByCode(code);
      const shares = await db
        .select()
        .from(schema.shareSessions)
        .where(eq(schema.shareSessions.roomId, room.id));
      assert.equal(shares.length, Object.keys(scenario.expected).length);
      for (const [sid, withAudio] of Object.entries(scenario.expected)) {
        assert.equal(
          shares.find((share) => share.trackSid === `TR_${sid}_${code}`)?.withAudio,
          withAudio,
          sid,
        );
      }
    });
  }

  test("expiry of source audio events does not erase audio from older history", async () => {
    const code = newRoom();
    const participant = { identity: `retained-${code}`, joinedAt: T };
    await send({
      event: "track_published",
      room: code,
      at: T + 1,
      participant,
      track: { sid: `TR_audio_${code}`, source: "SCREEN_SHARE_AUDIO" },
    });
    await send({
      event: "track_published",
      room: code,
      at: T + 2,
      participant,
      track: { sid: `TR_old_${code}`, source: "SCREEN_SHARE" },
    });
    await send({
      event: "track_unpublished",
      room: code,
      at: T + 4,
      participant,
      track: { sid: `TR_old_${code}`, source: "SCREEN_SHARE" },
    });
    await db
      .delete(schema.livekitEvents)
      .where(
        and(
          eq(schema.livekitEvents.roomName, code),
          eq(schema.livekitEvents.event, "track_published"),
          sql`${schema.livekitEvents.payload}->'track'->>'source' = 'SCREEN_SHARE_AUDIO'`,
        ),
      );
    await send({
      event: "track_published",
      room: code,
      at: T + 100,
      participant,
      track: { sid: `TR_new_${code}`, source: "SCREEN_SHARE" },
    });
    const shares = await db
      .select()
      .from(schema.shareSessions)
      .where(eq(schema.shareSessions.roomId, (await roomByCode(code)).id));
    assert.equal(shares.find((share) => share.trackSid === `TR_old_${code}`)?.withAudio, true);
    assert.equal(shares.find((share) => share.trackSid === `TR_new_${code}`)?.withAudio, false);
  });

  test("simultaneous joins of the same account in different rooms are projected", async () => {
    const id = await newUser("Simultanea");
    const codes = [newRoom(), newRoom()];
    await Promise.all(
      codes.map((room) =>
        send({
          event: "participant_joined",
          room,
          at: T,
          participant: { identity: id, name: "Simultanea", joinedAt: T, sid: `PA_${room}` },
        }),
      ),
    );
    for (const code of codes) {
      const room = await roomByCode(code);
      const all = await participationsOf(room.id);
      assert.equal(all.length, 1);
      assert.equal(all[0]?.userId, id);
      const events = await db
        .select()
        .from(schema.livekitEvents)
        .where(eq(schema.livekitEvents.roomName, code));
      assert.ok(events.every((event) => event.processedAt !== null && event.error === null));
    }
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
    assert.equal(user?.participationsCount, 2);
  });

  test("webhooks after anonymization do not restore names, not even on new connections", async () => {
    const code = newRoom();
    const id = await newUser("Pessoa");
    const participant = { identity: id, name: "Nome Original", joinedAt: T };
    await send({ event: "participant_joined", room: code, at: T, participant });
    await db.transaction((tx) => anonymizeParticipant(tx, id));
    await send({ event: "participant_left", room: code, at: T + 30, participant });
    await send({
      event: "participant_joined",
      room: code,
      at: T + 40,
      participant: { ...participant, sid: `PA_nova_${code}`, joinedAt: T + 40 },
    });
    const room = await roomByCode(code);
    const all = await participationsOf(room.id);
    assert.equal(all.length, 2);
    assert.ok(all.every((row) => row.displayName === null));
    assert.ok(all.every((row) => row.userId === id));
  });

  test("room finish received before the join and the screen closes late records", async () => {
    const code = newRoom();
    const participant = { identity: "atrasado", joinedAt: T + 1 };
    await send({ event: "room_started", room: code, at: T });
    await send({ event: "room_finished", room: code, at: T + 60 });
    await send({ event: "participant_joined", room: code, at: T + 1, participant });
    await send({
      event: "track_published",
      room: code,
      at: T + 10,
      participant,
      track: { sid: `TR_atrasada_${code}`, source: "SCREEN_SHARE" },
    });
    const room = await roomByCode(code);
    assert.equal(room.status, "finished");
    const [participation] = await participationsOf(room.id);
    assert.equal(participation?.leftAt?.getTime(), (T + 60) * 1000);
    assert.equal(participation?.leaveReason, "room_closed");
    const [share] = await db
      .select()
      .from(schema.shareSessions)
      .where(eq(schema.shareSessions.roomId, room.id));
    assert.equal(share?.endedAt?.getTime(), (T + 60) * 1000);
    assert.equal(share?.durationSeconds, 50);
    // A leave that happened even earlier than the finish corrects the room's estimate.
    await send({
      event: "participant_left",
      room: code,
      at: T + 50,
      participant: { ...participant, reason: "CLIENT_INITIATED" },
    });
    const [left] = await participationsOf(room.id);
    const [ended] = await db
      .select()
      .from(schema.shareSessions)
      .where(eq(schema.shareSessions.roomId, room.id));
    assert.equal(left?.leftAt?.getTime(), (T + 50) * 1000);
    assert.equal(left?.leaveReason, "left");
    assert.equal(ended?.durationSeconds, 40);
  });

  test("old join stays closed when it arrives after the reopening", async () => {
    const code = newRoom();
    await send({ event: "room_started", room: code, at: T });
    await send({ event: "room_finished", room: code, at: T + 60 });
    await send({
      event: "participant_joined",
      room: code,
      at: T + 120,
      participant: { identity: "nova-abertura", joinedAt: T + 120 },
    });
    await send({
      event: "participant_joined",
      room: code,
      at: T + 1,
      participant: { identity: "abertura-antiga", joinedAt: T + 1 },
    });
    const room = await roomByCode(code);
    assert.equal(room.status, "active");
    const all = await participationsOf(room.id);
    assert.equal(
      all.find((row) => row.livekitIdentity === "abertura-antiga")?.leftAt?.getTime(),
      (T + 60) * 1000,
    );
    assert.equal(all.find((row) => row.livekitIdentity === "nova-abertura")?.leftAt, null);
  });

  test("screen received after the leave inherits the participation's end", async () => {
    const code = newRoom();
    const participant = { identity: `saida-${code}`, joinedAt: T };
    await send({ event: "participant_left", room: code, at: T + 50, participant });
    await send({
      event: "track_published",
      room: code,
      at: T + 10,
      participant,
      track: { sid: `TR_saida_${code}`, source: "SCREEN_SHARE" },
    });
    const [share] = await db
      .select()
      .from(schema.shareSessions)
      .where(eq(schema.shareSessions.trackSid, `TR_saida_${code}`));
    assert.equal(share?.durationSeconds, 40);
  });

  test("full room: join, screen share with audio, leave and finish", async () => {
    const code = newRoom();
    const ana = await newUser("Ana");
    const bia = await newUser("Bia");
    await db.insert(schema.roomDefinitions).values({ code, ownerUserId: ana });
    // Token request that let Ana in (her IP).
    await db.insert(schema.tokenRequests).values({
      roomCode: code,
      userId: ana,
      result: "granted",
      ip: "203.0.113.7",
      createdAt: new Date((T - 30) * 1000),
    });

    await send({ event: "room_started", room: code, at: T });
    await send({
      event: "participant_joined",
      room: code,
      at: T + 1,
      participant: { identity: ana, name: "Ana", joinedAt: T + 1 },
    });
    await send({
      event: "participant_joined",
      room: code,
      at: T + 5,
      participant: { identity: bia, name: "Bia", joinedAt: T + 5 },
    });
    // Track events: no joined_at or name. The screen audio comes before the video.
    const anaP = { identity: ana };
    await send({
      event: "track_published",
      room: code,
      at: T + 10,
      participant: anaP,
      track: { sid: `TR_audio_${code}`, source: "SCREEN_SHARE_AUDIO" },
    });
    await send({
      event: "track_published",
      room: code,
      at: T + 10,
      participant: anaP,
      track: { sid: `TR_tela_${code}`, source: "SCREEN_SHARE" },
    });
    await send({
      event: "track_published",
      room: code,
      at: T + 12,
      participant: anaP,
      track: { sid: `TR_mic_${code}`, source: "MICROPHONE" },
    });
    await send({
      event: "track_unpublished",
      room: code,
      at: T + 70,
      participant: anaP,
      track: { sid: `TR_tela_${code}`, source: "SCREEN_SHARE" },
    });
    await send({
      event: "participant_left",
      room: code,
      at: T + 80,
      participant: { identity: bia, name: "Bia", joinedAt: T + 5, reason: "CLIENT_INITIATED" },
    });
    await send({ event: "room_finished", room: code, at: T + 100 });

    const room = await roomByCode(code);
    assert.equal(room.status, "finished");
    assert.equal(room.peakParticipants, 2);
    assert.equal(room.createdByUserId, ana);
    assert.equal(room.finishedAt?.getTime(), (T + 100) * 1000);

    const all = await participationsOf(room.id);
    assert.equal(all.length, 2, "tracks do not create extra participations");
    const [first, second] = all;
    assert.equal(first?.userId, ana);
    assert.equal(first?.displayName, "Ana");
    assert.equal(first?.joinedAt.getTime(), (T + 1) * 1000);
    assert.equal(first?.ip, "203.0.113.7");
    assert.equal(first?.leaveReason, "room_closed");
    assert.equal(second?.userId, bia);
    assert.equal(second?.leaveReason, "left");
    assert.equal(second?.leftAt?.getTime(), (T + 80) * 1000);

    const shares = await db
      .select()
      .from(schema.shareSessions)
      .where(eq(schema.shareSessions.roomId, room.id));
    assert.equal(shares.length, 1, "microphone is not a screen share");
    assert.equal(shares[0]?.withAudio, true);
    assert.equal(shares[0]?.durationSeconds, 60);
  });

  test("resending the same event duplicates nothing", async () => {
    const code = newRoom();
    const body = payload({
      event: "participant_joined",
      room: code,
      at: T,
      participant: { identity: "visitante-1", name: "Visita", joinedAt: T },
    });
    await send(body);
    await send(body);
    await send(body);
    const room = await roomByCode(code);
    assert.equal((await participationsOf(room.id)).length, 1);
    const events = await db
      .select()
      .from(schema.livekitEvents)
      .where(eq(schema.livekitEvents.roomName, code));
    assert.equal(events.length, 1);
    assert.ok(events[0]?.processedAt);
    assert.equal(room.peakParticipants, 1);
  });

  test("out of order: leave before join and share end before share start", async () => {
    const code = newRoom();
    const caio = await newUser("Caio");
    const p = { identity: caio, name: "Caio", joinedAt: T };
    const track = { identity: caio };
    await send({
      event: "track_unpublished",
      room: code,
      at: T + 40,
      participant: track,
      track: { sid: `TR_${code}`, source: "SCREEN_SHARE" },
    });
    await send({
      event: "participant_left",
      room: code,
      at: T + 50,
      participant: { ...p, reason: "SIGNAL_CLOSE" },
    });
    await send({
      event: "track_published",
      room: code,
      at: T + 10,
      participant: track,
      track: { sid: `TR_${code}`, source: "SCREEN_SHARE" },
    });
    await send({ event: "participant_joined", room: code, at: T, participant: p });

    const room = await roomByCode(code);
    const participations = await participationsOf(room.id);
    assert.equal(participations.length, 1);
    assert.equal(participations[0]?.joinedAt.getTime(), T * 1000, "the join corrects the start");
    assert.equal(participations[0]?.displayName, "Caio");
    assert.equal(
      participations[0]?.leftAt?.getTime(),
      (T + 50) * 1000,
      "the late join does not reopen",
    );
    assert.equal(participations[0]?.leaveReason, "disconnected");
    const [share] = await db
      .select()
      .from(schema.shareSessions)
      .where(eq(schema.shareSessions.trackSid, `TR_${code}`));
    assert.equal(share?.startedAt.getTime(), (T + 10) * 1000);
    assert.equal(share?.durationSeconds, 30);
  });

  test("late finish does not close a room that was already reopened", async () => {
    const code = newRoom();
    await send({ event: "room_started", room: code, at: T });
    await send({ event: "room_finished", room: code, at: T + 60 });
    assert.equal((await roomByCode(code)).status, "finished");

    // Reopened: someone joined after the finish.
    await send({
      event: "participant_joined",
      room: code,
      at: T + 120,
      participant: { identity: "visitante-2", joinedAt: T + 120 },
    });
    let room = await roomByCode(code);
    assert.equal(room.status, "active");
    assert.equal(room.finishedAt, null);

    // The finish of the 1st opening arrives again (another id): it stays active.
    await send({ event: "room_finished", room: code, at: T + 60 });
    room = await roomByCode(code);
    assert.equal(room.status, "active");
    const [online] = await participationsOf(room.id);
    assert.equal(online?.leftAt, null);
  });

  test("room with a non-conforming name is ignored, but the event is recorded", async () => {
    const name = `Sala Estranha ${Date.now()}`;
    await send({ event: "room_started", room: name, at: T });
    const [event] = await db
      .select()
      .from(schema.livekitEvents)
      .where(eq(schema.livekitEvents.roomName, name));
    assert.ok(event?.processedAt);
    assert.equal(event?.error, null);
    assert.equal(await db.query.rooms.findFirst({ where: eq(schema.rooms.code, name) }), undefined);
  });

  test("event stored but not projected (crash midway) is reprocessed", async () => {
    const code = newRoom();
    await db.insert(schema.livekitEvents).values({
      id: `EV_pendente_${code}`,
      event: "participant_joined",
      roomName: code,
      occurredAt: new Date(T * 1000),
      payload: JSON.parse(
        payload({
          event: "participant_joined",
          room: code,
          at: T,
          participant: { identity: "visitante-3", joinedAt: T },
        }),
      ) as Record<string, unknown>,
    });
    const result = await reprocessPendingEvents(db);
    assert.ok(result.projected >= 1);
    const room = await roomByCode(code);
    assert.equal((await participationsOf(room.id)).length, 1);
    const [event] = await db
      .select()
      .from(schema.livekitEvents)
      .where(eq(schema.livekitEvents.roomName, code));
    assert.ok(event?.processedAt);
  });
});

/** LiveKit for ban enforcement: records who the webhook disconnects. */
function recordingGateway() {
  const removed: string[] = [];
  return {
    removed,
    removeParticipant: (_room: string, identity: string) => {
      removed.push(identity);
      return Promise.resolve(true);
    },
  };
}

describe("bans on join", () => {
  test("someone banned from this call who joins with an old token is removed again", async () => {
    const code = newRoom();
    const identity = "convidado-banido-webhook";
    // The test payload uses `RM_<code>` as the call's sid.
    await db
      .insert(schema.roomBans)
      .values({ roomCode: code, identity, livekitRoomSid: `RM_${code}` });
    const gateway = recordingGateway();
    await send(
      { event: "participant_joined", room: code, at: T, participant: { identity, joinedAt: T } },
      gateway,
    );
    assert.deepEqual(gateway.removed, [identity]);
  });

  test("a ban from another call, or another person, is not removed", async () => {
    const code = newRoom();
    await db
      .insert(schema.roomBans)
      .values({ roomCode: code, identity: "banido-antes", livekitRoomSid: "RM_chamada-antiga" });
    const gateway = recordingGateway();
    for (const identity of ["banido-antes", "outra-pessoa"]) {
      await send(
        { event: "participant_joined", room: code, at: T, participant: { identity, joinedAt: T } },
        gateway,
      );
    }
    assert.deepEqual(gateway.removed, []);
  });
});
