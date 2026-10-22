/** What an attachment may be, told from its first bytes (ADR 0011). */
export const ATTACHMENT_KINDS = ["image", "pdf", "text", "audio", "video", "zip"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

const MEGABYTE = 1024 * 1024;

/** Per file, by the sender's plan; the 1 GB is a technical ceiling between panel owners. */
export const ATTACHMENT_LIMITS = {
  free: 10 * MEGABYTE,
  pro: 100 * MEGABYTE,
  owners: 1024 * MEGABYTE,
} as const;

/** How many first bytes the server reads to tell the type. */
export const SNIFF_BYTES = 512;

/** File names longer than this are refused; the name only labels the download. */
const MAX_FILE_NAME = 200;

/**
 * Programs and scripts, refused by name whatever their content: a `.bat` or `.ps1` is plain
 * text inside, and a `.jar` is a zip.
 */
const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "com",
  "bat",
  "cmd",
  "msi",
  "msp",
  "scr",
  "pif",
  "cpl",
  "ps1",
  "psm1",
  "vbs",
  "vbe",
  "js",
  "jse",
  "wsf",
  "wsh",
  "hta",
  "jar",
  "apk",
  "app",
  "dmg",
  "pkg",
  "deb",
  "rpm",
  "sh",
  "dll",
  "lnk",
  "reg",
  "iso",
  "appimage",
]);

/** The limit for one file: the sender's plan, or the owners' ceiling when everyone is an owner. */
export function attachmentLimit({
  senderPro,
  everyoneIsOwner,
}: {
  senderPro: boolean;
  everyoneIsOwner: boolean;
}): number {
  if (everyoneIsOwner) return ATTACHMENT_LIMITS.owners;
  if (senderPro) return ATTACHMENT_LIMITS.pro;
  return ATTACHMENT_LIMITS.free;
}

/** ASCII control characters (a NUL or a line break has no place in a file name). */
function isControl(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  return code < 0x20 || code === 0x7f;
}

/** The name as it will be shown and downloaded: no folders, no control characters, trimmed. */
export function cleanFileName(name: string): string | null {
  const base = name.split(/[\\/]/).at(-1) ?? "";
  // Code units, joined back in order: a control character is never half of a pair.
  const cleaned = base
    .split("")
    .filter((unit) => !isControl(unit))
    .join("")
    .trim();
  if (cleaned.length === 0) return null;
  if (cleaned.length > MAX_FILE_NAME) return null;
  return cleaned;
}

/** Whether the name ends in a program's extension (`foto.png.exe` included). */
export function hasBlockedExtension(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return false;
  return BLOCKED_EXTENSIONS.has(fileName.slice(dot + 1).toLowerCase());
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** ISO media (`ftyp` box): audio for the M4A brands, video for the rest. */
function isoMediaKind(bytes: Uint8Array): AttachmentKind | null {
  if (ascii(bytes, 4, 4) !== "ftyp") return null;
  const brand = ascii(bytes, 8, 4);
  if (brand === "M4A " || brand === "M4B ") return "audio";
  return "video";
}

/** RIFF containers: WAV is audio, AVI is video, WebP is an image. */
function riffKind(bytes: Uint8Array): AttachmentKind | null {
  if (ascii(bytes, 0, 4) !== "RIFF") return null;
  const format = ascii(bytes, 8, 4);
  const kinds: Record<string, AttachmentKind> = { WAVE: "audio", "AVI ": "video", WEBP: "image" };
  return kinds[format] ?? null;
}

/** Signatures by their first bytes, in the order they are checked. */
const SIGNATURES: readonly { bytes: readonly number[]; kind: AttachmentKind }[] = [
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], kind: "image" },
  { bytes: [0xff, 0xd8, 0xff], kind: "image" },
  { bytes: [0x47, 0x49, 0x46, 0x38], kind: "image" },
  { bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], kind: "pdf" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], kind: "zip" },
  { bytes: [0x50, 0x4b, 0x05, 0x06], kind: "zip" },
  { bytes: [0x49, 0x44, 0x33], kind: "audio" },
  { bytes: [0x4f, 0x67, 0x67, 0x53], kind: "audio" },
  { bytes: [0x66, 0x4c, 0x61, 0x43], kind: "audio" },
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], kind: "video" },
];

/** Plain text: valid UTF-8 without NUL bytes (a cut last character is fine). */
function isText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true });
    return true;
  } catch {
    // Not UTF-8: binary content of a kind we do not accept.
    return false;
  }
}

/**
 * The kind of a file from its first bytes, or `null` when it is none of the accepted kinds.
 * The name never decides: a program renamed to `.png` is still refused here.
 */
export function detectAttachmentKind(bytes: Uint8Array): AttachmentKind | null {
  const signed = SIGNATURES.find((signature) => startsWith(bytes, signature.bytes));
  if (signed !== undefined) return signed.kind;
  const container = isoMediaKind(bytes) ?? riffKind(bytes);
  if (container !== null) return container;
  if (startsWith(bytes, [0xff, 0xfb]) || startsWith(bytes, [0xff, 0xf3])) return "audio";
  if (isText(bytes)) return "text";
  return null;
}

/** An attachment as the conversation shows it; `previewUrl` only for images, short-lived. */
export interface MessageAttachment {
  id: string;
  fileName: string;
  kind: AttachmentKind;
  size: number;
  previewUrl: string | null;
}

const sizeFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "0,2 KB", "2,4 MB", "1 GB": how a file's size reads in the conversation. */
export function readableSize(bytes: number): string {
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${sizeFormat.format(Math.max(kilobytes, 0.1))} KB`;
  const megabytes = kilobytes / 1024;
  if (megabytes < 1024) return `${sizeFormat.format(megabytes)} MB`;
  return `${sizeFormat.format(megabytes / 1024)} GB`;
}

const KIND_LABEL: Record<AttachmentKind, string> = {
  image: "Imagem",
  pdf: "PDF",
  text: "Texto",
  audio: "Áudio",
  video: "Vídeo",
  zip: "ZIP",
};

/** The short type shown next to the size on a file card. */
export function kindLabel(kind: AttachmentKind): string {
  return KIND_LABEL[kind];
}
