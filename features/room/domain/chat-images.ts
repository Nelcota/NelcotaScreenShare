/**
 * Images in the call chat (#412): sent straight to the people in the call over the data
 * channel, never stored. They come from other browsers, so the size and the real file
 * type (its first bytes, not the name or the declared type) are checked before showing.
 */

export const CHAT_IMAGE_TOPIC = "nelcota.chat-image";

/** 5 MB: enough for a full-screen print, small enough for everyone in the call. */
export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type ChatImageType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export const CHAT_IMAGE_TYPES: readonly ChatImageType[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

const NOT_AN_IMAGE_MESSAGE = "Envie só imagens: PNG, JPG, WebP ou GIF.";
const IMAGE_TOO_BIG_MESSAGE = "A imagem passa de 5 MB.";
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

/** Why a file picked or pasted here cannot be sent, or undefined when it can. */
export function chatImageProblem(file: { type: string; size: number }): string | undefined {
  if (!isChatImageType(file.type)) return NOT_AN_IMAGE_MESSAGE;
  if (file.size > CHAT_IMAGE_MAX_BYTES) return IMAGE_TOO_BIG_MESSAGE;
  return undefined;
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
