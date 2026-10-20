import {
  CHAT_IMAGE_MAX_BYTES,
  goesAsPicked,
  reducedSize,
} from "@/features/room/domain/chat-images";

/** The image could not be brought within what goes out (5 MB), even reduced. */
export class ChatImageTooHeavyError extends Error {
  constructor() {
    super("Não deu para deixar a imagem com menos de 5 MB. Escolha outra.");
    this.name = "ChatImageTooHeavyError";
  }
}

/** WebP first; a browser that cannot write WebP (Safari) answers PNG, so JPEG instead. */
const FORMATS = [
  { type: "image/webp", extension: "webp" },
  { type: "image/jpeg", extension: "jpg" },
] as const;
const QUALITIES = [0.85, 0.7, 0.5];

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

function renamed(name: string, extension: string): string {
  const base = name.replace(/\.[^.]*$/, "");
  return `${base || "imagem"}.${extension}`;
}

/** The first encoding, from the best, that the browser writes and that fits in 5 MB. */
async function encodeWithin(canvas: HTMLCanvasElement, name: string): Promise<File> {
  for (const format of FORMATS) {
    for (const quality of QUALITIES) {
      const blob = await canvasBlob(canvas, format.type, quality);
      // Measured on what goes out, after every transformation.
      if (blob?.type !== format.type) break;
      if (blob.size <= CHAT_IMAGE_MAX_BYTES) {
        return new File([blob], renamed(name, format.extension), { type: format.type });
      }
    }
  }
  throw new ChatImageTooHeavyError();
}

/**
 * The image as it goes out (#496): as picked when it already fits; otherwise reduced in this
 * browser, the longest side at 2560 px, until it is within 5 MB. A GIF is never reduced.
 */
export async function prepareChatImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  try {
    const picked = { type: file.type, size: file.size, width: bitmap.width, height: bitmap.height };
    if (goesAsPicked(picked)) return file;
    const size = reducedSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem. Tente de novo.");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return await encodeWithin(canvas, file.name);
  } finally {
    bitmap.close();
  }
}

/** Message shown when `prepareChatImage` fails (an undecodable file throws a DOMException). */
export function chatImageErrorMessage(failure: unknown): string {
  if (failure instanceof DOMException) return "Não foi possível abrir a imagem. Escolha outra.";
  if (failure instanceof Error) return failure.message;
  return "Não foi possível preparar a imagem.";
}
