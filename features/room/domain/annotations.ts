import { z } from "zod";
import { roomControlInputSchema } from "./host-controls";

export const ANNOTATION_TTL = 10_000;
export const ANNOTATION_BYTES = 6_144;
const MAX_ANNOTATIONS = 40;
const annotationPointSchema = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .strict();
export type AnnotationPoint = z.infer<typeof annotationPointSchema>;
export type AnnotationTool = "arrow" | "circle" | "pen";
const envelope = z.object({
  v: z.literal(1),
  sessionId: z.uuid(),
  trackSid: z.string().min(1).max(64),
  epoch: z.uuid(),
  id: z.uuid(),
});
export const annotationMessageSchema = z.discriminatedUnion("kind", [
  envelope.extend({ kind: z.literal("remove") }).strict(),
  envelope
    .extend({
      kind: z.literal("mark"),
      shape: z.enum(["arrow", "circle", "pen"]),
      points: z.array(annotationPointSchema).min(2).max(64),
      createdAt: z.number().int().positive(),
      preview: z.boolean(),
    })
    .strict(),
]);
export type AnnotationMessage = z.infer<typeof annotationMessageSchema>;
export type AnnotationMark = Extract<AnnotationMessage, { kind: "mark" }> & {
  author: string;
  name: string;
  expiresAt: number;
};
export const annotationInputSchema = roomControlInputSchema.extend({
  trackSid: z.string().min(1).max(64),
});
export const annotationStateSchema = z.object({
  epoch: z.uuid(),
  revision: z.number().int().positive(),
  canClear: z.boolean(),
});
export type AnnotationState = z.infer<typeof annotationStateSchema>;

/** The actual sender owns the key; neither a name nor role arrives in a drawing. */
export function acceptAnnotation(
  list: readonly AnnotationMark[],
  message: AnnotationMessage,
  author: string,
  name: string,
  context: { sessionId: string; trackSid: string; epoch: string },
  now: number,
): AnnotationMark[] {
  const live = list.filter((mark) => mark.expiresAt > now);
  if (
    message.sessionId !== context.sessionId ||
    message.trackSid !== context.trackSid ||
    message.epoch !== context.epoch
  )
    return live;
  const other = live.filter((mark) => mark.author !== author || mark.id !== message.id);
  if (message.kind === "remove") return other;
  if (message.createdAt < now - ANNOTATION_TTL || message.createdAt > now + 5_000) return live;
  const previous = live.find(
    (mark) => mark.author === author && mark.id === message.id && !mark.preview,
  );
  // Preview packets are unreliable and can arrive after the reliable completed mark.
  if (previous && message.preview) return live;
  const lifetime = message.preview ? 750 : ANNOTATION_TTL;
  const expiresAt = Math.min(
    previous?.expiresAt ?? Infinity,
    message.createdAt + lifetime,
    now + lifetime,
  );
  const own = other.filter((mark) => mark.author === author);
  if (own.length >= 8) return live;
  return [...other.slice(-(MAX_ANNOTATIONS - 1)), { ...message, author, name, expiresAt }];
}
