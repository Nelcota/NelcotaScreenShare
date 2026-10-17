import { z } from "zod";

/**
 * Messages exchanged over the LiveKit data channel. They come from other
 * browsers, so everything is validated before it becomes state.
 */
export const TOPICS = {
  reaction: "nelcota.reaction",
  pointer: "nelcota.pointer",
  annotation: "nelcota.annotation.v1",
  annotationEpoch: "nelcota.annotation.epoch",
  screenStats: "nelcota.screen-stats",
  screenPreview: "nelcota.screen-preview",
  screenWatch: "nelcota.screen-watch",
} as const;

export const REACTIONS = ["👍", "👏", "😂", "❤️", "🎉", "😮"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const reactionSchema = z.object({ emoji: z.enum(REACTIONS) });

/** Point on the shared screen, as fractions (0–1) of the video image. */
export const pointerSchema = z.object({
  trackSid: z.string().min(1).max(64),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type PointerMessage = z.infer<typeof pointerSchema>;

/** The presenter's own round trip to the media server, sent to the viewers of that screen. */
export const screenStatsSchema = z.object({
  trackSid: z.string().min(1).max(64),
  pingMs: z.number().int().min(0).max(60_000),
});

/** Longest preview accepted: a 160 px WebP is a few KB; anything far bigger is not ours. */
export const SCREEN_PREVIEW_MAX_LENGTH = 24_000;

/**
 * A tiny, blurred frame of a shared screen, sent every few seconds to the room so the
 * sharer's tile hints at what is on it. It lives only in the browsers' memory.
 */
export const screenPreviewSchema = z.object({
  trackSid: z.string().min(1).max(64),
  image: z
    .string()
    .max(SCREEN_PREVIEW_MAX_LENGTH)
    .regex(/^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/),
});

/**
 * Sent only to a screen's sharer when someone starts or stops watching it, so the sharer
 * hears it (#413). Nothing else reads it.
 */
export const screenWatchSchema = z.object({
  trackSid: z.string().min(1).max(64),
  watching: z.boolean(),
});

/** Participant attribute for "raise hand". */
export const HAND_ATTRIBUTE = "hand";
/** "1" while the person stopped hearing the room (written by the server, /api/sala/som). */
export const DEAFENED_ATTRIBUTE = "deafened";

/** Chat limit (LiveKit accepts more; long messages hurt readability). */
export const CHAT_MAX_LENGTH = 500;

/**
 * Received chat text within the limit: the composer caps what this app sends, but
 * another client can send any length.
 */
export function capChatText(text: string): string {
  return text.slice(0, CHAT_MAX_LENGTH);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeMessage(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

export function decodeMessage<T>(payload: Uint8Array, schema: z.ZodType<T>): T | undefined {
  try {
    const parsed = schema.safeParse(JSON.parse(decoder.decode(payload)));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Limit on the RECEIVER: the sender already spaces out its sends, but a modified
 * client could flood the others. Accepts at most one message per
 * sender every `minGapMs` (half the send interval, leaving room for
 * network jitter to bunch two legitimate messages together).
 */
export function createReceiveThrottle(minGapMs: number, now: () => number = Date.now) {
  const last = new Map<string, number>();
  return function accept(sender: string): boolean {
    const time = now();
    const previous = last.get(sender);
    if (previous !== undefined && time - previous < minGapMs) return false;
    last.set(sender, time);
    return true;
  };
}
