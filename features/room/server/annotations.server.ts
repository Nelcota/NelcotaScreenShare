import { canHostDefinition } from "@/features/rooms/server/room-access.server";
import { and, eq, sql } from "drizzle-orm";
import { DataPacket_Kind, TrackSource } from "livekit-server-sdk";
import { getDb, type DbExecutor } from "@/server/db/index.server";
import { annotationEpochs } from "@/server/db/schema/annotations";
import { roomSessions } from "@/server/db/schema/room-control";
import { getEnv } from "@/server/env.server";
import { forbiddenCrossSite, isCrossSiteMutation } from "@/server/origin-guard.server";
import { readJsonBody, SMALL_JSON_MAX_BYTES } from "@/server/body.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { createAuditRecorder } from "@/server/audit.server";
import { annotationInputSchema } from "@/features/room/domain/annotations";
import { TOPICS, encodeMessage } from "@/features/room/domain/data-channel";
import { lockControlRoom, memberInSession, sessionByMediaName } from "./session-store.server";
import { roomCaller, type RoomCaller } from "./room-caller.server";
import { controlGateway } from "./control-gateway.server";
import { roomService } from "./room-service.server";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function annotationRequest(request: Request) {
  if (!getEnv().ROOM_HOST_CONTROLS_ENABLED) return new Response(null, { status: 404 });
  const clearing = request.method === "POST";
  if (clearing && isCrossSiteMutation(request)) return forbiddenCrossSite();
  const caller = await roomCaller(request);
  if (!caller) return new Response(null, { status: 401 });
  if (clearing && !limiter.hit(caller.identity).ok) return new Response(null, { status: 429 });
  const input = annotationInputSchema.safeParse(
    clearing
      ? await readJsonBody(request, SMALL_JSON_MAX_BYTES)
      : Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!input.success) return new Response(null, { status: 400 });
  const { room, sessionId, trackSid } = input.data;
  const result = await getDb().transaction(async (tx) => {
    await lockControlRoom(tx, room);
    const access = await annotationAccess(tx, input.data, caller, clearing);
    if (!access) return undefined;
    const { fingerprint, canClear, mediaName } = access;
    const [existing] = await tx
      .select()
      .from(annotationEpochs)
      .where(
        and(eq(annotationEpochs.sessionId, sessionId), eq(annotationEpochs.trackSid, trackSid)),
      );
    const changed = clearing || existing?.fingerprint !== fingerprint;
    const [state] = await tx
      .insert(annotationEpochs)
      .values({ sessionId, trackSid, epoch: crypto.randomUUID(), fingerprint })
      .onConflictDoUpdate({
        target: [annotationEpochs.sessionId, annotationEpochs.trackSid],
        set: changed
          ? {
              epoch: crypto.randomUUID(),
              revision: sql`${annotationEpochs.revision} + 1`,
              fingerprint,
            }
          : { fingerprint },
      })
      .returning();
    if (!state) throw new Error("Annotation epoch was not saved");
    if (clearing)
      await createAuditRecorder(
        caller.kind === "account" ? { userId: caller.identity } : "system",
      ).record(tx, {
        action: "room.annotations_clear",
        resourceType: "room_session",
        resourceId: sessionId,
        metadata: { tela: trackSid },
      });
    return {
      epoch: state.epoch,
      revision: state.revision,
      canClear,
      mediaName,
    };
  });
  if (!result) return new Response(null, { status: 403 });
  if (clearing)
    await roomService()
      .sendData(result.mediaName, encodeMessage({ trackSid }), DataPacket_Kind.RELIABLE, {
        topic: TOPICS.annotationEpoch,
      })
      .catch(() => {});
  return Response.json(
    { epoch: result.epoch, revision: result.revision, canClear: result.canClear },
    { headers: { "Cache-Control": "no-store" } },
  );
}

type Input = { room: string; sessionId: string; trackSid: string };
async function admittedSession(tx: DbExecutor, input: Input, identity: string) {
  const [session] = await tx
    .select()
    .from(roomSessions)
    .where(eq(roomSessions.id, input.sessionId));
  if (!session || session.status === "closed") return undefined;
  const definition = await sessionByMediaName(tx, session.mediaRoomName);
  const member = await memberInSession(tx, input.sessionId, identity);
  if (definition?.code !== input.room || !member?.admittedAt || member.excludedAt) return undefined;
  return { session, definition: definition.definition };
}
async function annotationAccess(
  tx: DbExecutor,
  input: Input,
  caller: RoomCaller,
  clearing: boolean,
) {
  const access = await admittedSession(tx, input, caller.identity);
  if (!access) return undefined;
  const { session, definition } = access;
  const participants = await controlGateway.participants(session.mediaRoomName);
  const presenter = participants.find((person) =>
    person.tracks.some(
      (track) => track.sid === input.trackSid && track.source === TrackSource.SCREEN_SHARE,
    ),
  );
  const track = presenter?.tracks.find((publication) => publication.sid === input.trackSid);
  if (!presenter || !track) return undefined;
  const canClear =
    presenter.identity === caller.identity ||
    (session.hostUserId === caller.identity &&
      (await canHostDefinition(tx, definition, caller.identity)));
  if (clearing && !canClear) return undefined;
  return {
    canClear,
    fingerprint: `${track.width}x${track.height}`,
    mediaName: session.mediaRoomName,
  };
}
