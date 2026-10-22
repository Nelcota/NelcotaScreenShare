/**
 * Images in the call chat (#412): sent straight to the people in the call over the data
 * channel, never stored. They come from other browsers, so the size and the real file
 * type (its first bytes, not the name or the declared type) are checked before showing.
 */

import { z } from "zod";
import { capChatText } from "./data-channel";

export const CHAT_IMAGE_TOPIC = "nelcota.chat-image";

/** The text sent with an image, as an attribute of the same stream: one message, one send. */
export const CHAT_IMAGE_CAPTION_ATTRIBUTE = "caption";

const captionSchema = z.string();

/**
 * The text that came with a received image. It comes from another browser, so it is held to
 * the same limit as any chat text; anything that is not text is no caption at all.
 */
export function receivedCaption(attributes: Readonly<Record<string, string>> | undefined): string {
  const parsed = captionSchema.safeParse(attributes?.[CHAT_IMAGE_CAPTION_ATTRIBUTE]);
  if (!parsed.success) return "";
  return capChatText(parsed.data.trim());
}

/**
 * 5 MB: what goes out and what a receiver keeps, after the sender's browser reduces the
 * image. Enough for a full-screen print, small enough for everyone in the call.
 */
export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** A picked or pasted image may be this big: the browser reduces it before it goes. */
export const CHAT_IMAGE_PICK_MAX_BYTES = 25 * 1024 * 1024;
/** The longest side of an image once reduced: a full-screen print stays sharp. */
export const CHAT_IMAGE_MAX_SIDE = 2560;

export type ChatImageType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export const CHAT_IMAGE_TYPES: readonly ChatImageType[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

const NOT_AN_IMAGE_MESSAGE = "Envie imagens (PNG, JPG, WebP ou GIF) ou arquivos .txt.";
const IMAGE_TOO_BIG_MESSAGE = "A imagem passa de 25 MB.";
const GIF_TOO_BIG_MESSAGE = "O GIF passa de 5 MB.";
const TOO_MANY_IMAGES_MESSAGE = "Espere um pouco para mandar mais imagens.";

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** The image type the bytes really are, or undefined for anything else. */
export function imageTypeOf(bytes: Uint8Array): ChatImageType | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  const riff = startsWith(bytes, [0x52, 0x49, 0x46, 0x46]);
  if (riff && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return undefined;
}

function isChatImageType(type: string): type is ChatImageType {
  return CHAT_IMAGE_TYPES.some((allowed) => allowed === type);
}

/**
 * Why a file picked or pasted here cannot be sent, or undefined when it can. A GIF goes as
 * it is (reducing it would stop the animation), so it keeps the 5 MB that goes out.
 */
export function chatImageProblem(file: { type: string; size: number }): string | undefined {
  if (!isChatImageType(file.type)) return NOT_AN_IMAGE_MESSAGE;
  if (file.type === "image/gif" && file.size > CHAT_IMAGE_MAX_BYTES) return GIF_TOO_BIG_MESSAGE;
  if (file.size > CHAT_IMAGE_PICK_MAX_BYTES) return IMAGE_TOO_BIG_MESSAGE;
  return undefined;
}

/** An image that already fits goes as picked: reducing it again would only lose detail. */
export function goesAsPicked(image: {
  type: string;
  size: number;
  width: number;
  height: number;
}): boolean {
  if (image.type === "image/gif") return true;
  if (image.size > CHAT_IMAGE_MAX_BYTES) return false;
  return Math.max(image.width, image.height) <= CHAT_IMAGE_MAX_SIDE;
}

/** The reduced size: the longest side at most 2560 px, the shape kept, never enlarged. */
export function reducedSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, CHAT_IMAGE_MAX_SIDE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The type to show a received image as: within the size and really one of the image types,
 * whatever the sender declared. Anything else is dropped.
 */
export function receivedImageType(bytes: Uint8Array): ChatImageType | undefined {
  if (bytes.byteLength === 0 || bytes.byteLength > CHAT_IMAGE_MAX_BYTES) return undefined;
  return imageTypeOf(bytes);
}

/** Images one person can send in a minute: plenty for prints, too few to flood the call. */
export const CHAT_IMAGES_PER_MINUTE = 10;
const MINUTE_MS = 60_000;

/**
 * When a person's images arrived in the last minute, with this one added, or undefined when
 * this one goes over the limit and is dropped unread: each image stays in memory while the
 * call lasts, so someone sending hundreds would fill the others' browsers.
 */
export function admitImage(recent: readonly number[], now: number): readonly number[] | undefined {
  const lastMinute = recent.filter((time) => now - time < MINUTE_MS);
  if (lastMinute.length >= CHAT_IMAGES_PER_MINUTE) return undefined;
  return [...lastMinute, now];
}

/**
 * Why one more image cannot go out now: past the limit the others drop it, and the sender
 * would see an image nobody else got.
 */
export function sendingPaceProblem(recent: readonly number[], now: number): string | undefined {
  if (admitImage(recent, now)) return undefined;
  return TOO_MANY_IMAGES_MESSAGE;
}
