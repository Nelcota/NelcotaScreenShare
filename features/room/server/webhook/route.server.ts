import { createHash } from "node:crypto";
import { WebhookReceiver } from "livekit-server-sdk";
import { z } from "zod";
import { getDb, type Database } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { liveKitGateway, type LiveKitGateway } from "@/features/room/server/livekit-gateway.server";
import { removeBannedJoin } from "@/features/room/server/webhook/ban-enforcement.server";
import { webhookPayloadSchema } from "@/features/room/server/webhook/payload";
import { ingestEvent } from "@/features/room/server/webhook/projector.server";
import { logger } from "@/server/logger.server";
import { BodyTooLargeError, readBodyText } from "@/server/body.server";

/** Events that become a log line. The rest (tracks, egress…) only goes to the database. */
const LOGGED_EVENTS = new Set([
  "room_started",
  "room_finished",
  "participant_joined",
  "participant_left",
]);

let receiver: WebhookReceiver | undefined;

type BanGateway = Pick<LiveKitGateway, "removeParticipant">;

/** The serialized event is always a JSON object (the SDK type is wider). */
const eventObject = z.record(z.string(), z.unknown());

/** LiveKit events are a few KB; above that the body is not even read. */
const MAX_BODY_BYTES = 64 * 1024;

function tooLarge() {
  return Response.json({ error: "payload_too_large" }, { status: 413 });
}

/**
 * LiveKit webhook. The signature uses the same keys as the token, so only the
 * LiveKit server can call it. Each event is stored in `livekit_events`
 * and projected into rooms, participations and shares
 * (features/room/server/webhook/projector.server.ts). If storing fails, it
 * responds 503 so LiveKit retries; if only the projection fails, the event is
 * already saved and maintenance (features/runtime/server/maintenance.server.ts)
 * re-projects it later.
 */
async function readWebhookBody(request: Request): Promise<string | Response> {
  try {
    return await readBodyText(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return tooLarge();
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }
}

type WebhookEvent = Awaited<ReturnType<WebhookReceiver["receive"]>>;

async function verifiedEvent(
  webhookReceiver: WebhookReceiver,
  body: string,
  authorization: string | undefined,
): Promise<WebhookEvent | Response> {
  try {
    return await webhookReceiver.receive(body, authorization);
  } catch (error) {
    // Anyone can reach this endpoint: debug level keeps forged requests out of the
    // production log, and only the reason is kept.
    logger.debug(
      { source: "livekit-webhook", reason: error instanceof Error ? error.message : "unknown" },
      "LiveKit webhook rejected: invalid signature",
    );
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }
}

/**
 * Disconnects a banned person who joined with a token issued before the ban. A failure is
 * only logged: the event is already stored, and LiveKit must not redeliver it for this.
 */
async function enforceBans(db: Database, gateway: BanGateway, event: Record<string, unknown>) {
  const parsed = webhookPayloadSchema.safeParse(event);
  if (!parsed.success) return;
  try {
    if (!(await removeBannedJoin(db, gateway, parsed.data))) return;
    logger.info(
      {
        source: "livekit-webhook",
        room: parsed.data.room?.name,
        participant: { identity: parsed.data.participant?.identity },
      },
      "banned participant removed on join",
    );
  } catch (error) {
    logger.error({ err: error, source: "livekit-webhook" }, "failed to enforce a room ban");
  }
}

export async function receiveLivekitWebhook(
  request: Request,
  gateway: BanGateway = liveKitGateway,
) {
  const env = getEnv();
  receiver ??= new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

  const body = await readWebhookBody(request);
  if (body instanceof Response) return body;
  const authorization = request.headers.get("authorization") ?? undefined;
  const event = await verifiedEvent(receiver, body, authorization);
  if (event instanceof Response) return event;

  if (LOGGED_EVENTS.has(event.event)) {
    logger.info(
      {
        source: "livekit-webhook",
        event: event.event,
        room: event.room?.name,
        // Identity only: the display name is personal data and adds nothing to debugging.
        participant: event.participant ? { identity: event.participant.identity } : undefined,
        at: new Date(Number(event.createdAt) * 1000).toISOString(),
      },
      "LiveKit event",
    );
  }

  const db = getDb();
  // LiveKit always sends an id; the body hash covers a delivery without one.
  const id = event.id || `sha256:${createHash("sha256").update(body).digest("hex")}`;
  const stored = eventObject.parse(event.toJson());
  try {
    const result = await ingestEvent(db, id, stored);
    if (result === "failed") {
      logger.warn({ source: "livekit-webhook", id, event: event.event }, "event not projected");
    }
  } catch (error) {
    logger.error({ err: error, source: "livekit-webhook", id }, "failed to store event");
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
  await enforceBans(db, gateway, stored);
  return new Response(null, { status: 204 });
}
