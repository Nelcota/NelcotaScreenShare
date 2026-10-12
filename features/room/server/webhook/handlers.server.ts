import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { ROOM_CODE_PATTERN } from "@/features/room/domain/room-code";
import type { DbExecutor } from "@/server/db/index.server";
import { roomParticipations, rooms, shareSessions } from "@/server/db/schema";
import { leaveReasonFrom, occurredAt, type WebhookPayload } from "./payload";
import { closeShares, ensureParticipation, ensureRoom, updatePeak } from "./records.server";
import { reconcileShareAudio } from "./share-audio.server";
import { isDeletedRoomEvent, lockRoomCodes } from "../room-lifecycle.server";

export type ProjectionResult = "projected" | "ignored";

const ROOM_CODE = new RegExp(ROOM_CODE_PATTERN);

/** What every handler receives: the already validated event, the room and the time. */
interface EventContext {
  tx: DbExecutor;
  payload: WebhookPayload;
  code: string;
  at: Date;
}

type Handler = (ctx: EventContext) => Promise<ProjectionResult>;

const roomStarted: Handler = async ({ tx, payload, code, at }) => {
  const startedAt = payload.room?.creationTime ? new Date(payload.room.creationTime * 1000) : at;
  await ensureRoom(tx, code, startedAt, { reopen: true, sid: payload.room?.sid });
  return "projected";
};

const roomFinished: Handler = async ({ tx, payload, code, at }) => {
  const roomId = await ensureRoom(tx, code, at, { reopen: false, sid: payload.room?.sid });
  // Activity after this time (a late event from an already reopened room) keeps the room active.
  await tx
    .update(rooms)
    .set({ status: "finished", finishedAt: sql`greatest(${rooms.startedAt}, ${at}::timestamptz)` })
    .where(and(eq(rooms.id, roomId), eq(rooms.status, "active"), lte(rooms.lastActivityAt, at)));
  await tx
    .update(roomParticipations)
    .set({
      leftAt: sql`greatest(${roomParticipations.joinedAt}, ${at}::timestamptz)`,
      leaveReason: "room_closed",
    })
    .where(
      and(
        eq(roomParticipations.roomId, roomId),
        isNull(roomParticipations.leftAt),
        lte(roomParticipations.joinedAt, at),
      ),
    );
  await closeShares(tx, eq(shareSessions.roomId, roomId), at);
  await updatePeak(tx, roomId);
  await reconcileShareAudio(tx, roomId, code);
  return "projected";
};

const participantJoined: Handler = async ({ tx, payload, code, at }) => {
  if (!payload.participant) return "ignored";
  const roomId = await ensureRoom(tx, code, at, { reopen: true, sid: payload.room?.sid });
  await ensureParticipation(tx, roomId, code, payload.participant, at);
  await updatePeak(tx, roomId);
  return "projected";
};

const participantLeft: Handler = async ({ tx, payload, code, at }) => {
  const { participant } = payload;
  if (!participant) return "ignored";
  const roomId = await ensureRoom(tx, code, at, { reopen: false, sid: payload.room?.sid });
  const participation = await ensureParticipation(tx, roomId, code, participant, at);
  const reason =
    payload.event === "participant_connection_aborted"
      ? "disconnected"
      : leaveReasonFrom(participant.disconnectReason);
  await tx
    .update(roomParticipations)
    .set({
      leftAt: sql`greatest(${roomParticipations.joinedAt}, ${at}::timestamptz)`,
      leaveReason: reason,
    })
    .where(
      and(
        eq(roomParticipations.id, participation.id),
        sql`(${roomParticipations.leftAt} is null or ${roomParticipations.leftAt} >= ${at}::timestamptz)`,
      ),
    );
  await closeShares(tx, eq(shareSessions.participationId, participation.id), at);
  await updatePeak(tx, roomId);
  await reconcileShareAudio(tx, roomId, code);
  return "projected";
};

/** Audio can arrive before or after its video, including after the share has ended. */
const screenAudioChanged: Handler = async ({ tx, payload, code, at }) => {
  if (!payload.participant) return "ignored";
  const roomId = await ensureRoom(tx, code, at, {
    reopen: payload.event === "track_published",
    sid: payload.room?.sid,
  });
  await ensureParticipation(tx, roomId, code, payload.participant, at);
  await reconcileShareAudio(tx, roomId, code);
  return "projected";
};

/** Screen share started or ended (arrival order does not matter). */
const screenTrack: Handler = async ({ tx, payload, code, at }) => {
  const { participant, track } = payload;
  if (!participant || !track) return "ignored";
  const published = payload.event === "track_published";
  const roomId = await ensureRoom(tx, code, at, { reopen: published, sid: payload.room?.sid });
  const participation = await ensureParticipation(tx, roomId, code, participant, at);
  await tx
    .insert(shareSessions)
    .values({
      roomId,
      participationId: participation.id,
      trackSid: track.sid,
      startedAt: at,
      endedAt: published ? participation.leftAt : at,
    })
    .onConflictDoUpdate({
      target: shareSessions.trackSid,
      // The end arrived before the start: the start only moves the beginning earlier.
      set: published
        ? {
            startedAt: sql`least(${shareSessions.startedAt}, excluded.started_at)`,
            endedAt: sql`least(${shareSessions.endedAt}, excluded.ended_at)`,
          }
        : {
            endedAt: sql`greatest(${shareSessions.startedAt}, least(${shareSessions.endedAt}, excluded.ended_at))`,
          },
    });
  await reconcileShareAudio(tx, roomId, code);
  return "projected";
};

/** Tracks: only the screen (video) and its audio matter. */
const trackChanged: Handler = async (ctx) => {
  const source = ctx.payload.track?.source;
  if (source === "SCREEN_SHARE_AUDIO") {
    return screenAudioChanged(ctx);
  }
  return source === "SCREEN_SHARE" ? screenTrack(ctx) : "ignored";
};

const HANDLERS: Record<string, Handler> = {
  room_started: roomStarted,
  room_finished: roomFinished,
  participant_joined: participantJoined,
  participant_left: participantLeft,
  participant_connection_aborted: participantLeft,
  track_published: trackChanged,
  track_unpublished: trackChanged,
};

/** Applies an event to the tables. Idempotent: applying it again changes nothing. */
export async function projectEvent(
  tx: DbExecutor,
  payload: WebhookPayload,
): Promise<ProjectionResult> {
  const code = payload.room?.name;
  if (!code || !ROOM_CODE.test(code)) return "ignored";
  const handler = HANDLERS[payload.event];
  if (!handler) return "ignored";
  const at = occurredAt(payload);
  const opening = payload.room?.creationTime ? new Date(payload.room.creationTime * 1000) : at;
  await lockRoomCodes(tx, [code]);
  if (await isDeletedRoomEvent(tx, code, opening, payload.room?.sid)) return "ignored";
  return handler({ tx, payload, code, at });
}
