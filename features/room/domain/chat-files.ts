/**
 * Text files in the call chat: sent straight to the people in the call, like the
 * images, never stored. They come from another browser, so whoever receives one checks the
 * size, that it really is plain text, and cleans its name before showing anything.
 */

export const CHAT_FILE_TOPIC = "nelcota.chat-file";

/** 1 MB of text is about 500 pages: plenty for notes and logs, light for everyone. */
export const CHAT_TEXT_MAX_BYTES = 1024 * 1024;

const NAME_MAX_LENGTH = 80;
const PREVIEW_LINES = 12;
const PREVIEW_LINE_LENGTH = 200;

const NOT_TEXT_MESSAGE = "Envie só arquivos de texto (.txt).";
const TEXT_TOO_BIG_MESSAGE = "O arquivo passa de 1 MB.";
const NOT_PLAIN_TEXT_MESSAGE = "Esse arquivo não é texto simples.";

/** Line breaks and tabs are text; any other control character is not. */
// oxlint-disable-next-line eslint/no-control-regex -- finding control characters is the point.
const CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const CONTROL_CHARACTERS = new RegExp(CONTROL_CHARACTER.source, "gu");
const strictUtf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

/** Whether the picked file is a .txt, by its name: the type a browser declares varies. */
export function isTextFileName(name: string): boolean {
  return name.trim().toLowerCase().endsWith(".txt");
}

/** Why a file picked here cannot go as a text file, or undefined when it can. */
export function textFileProblem(file: { name: string; size: number }): string | undefined {
  if (!isTextFileName(file.name)) return NOT_TEXT_MESSAGE;
  if (file.size > CHAT_TEXT_MAX_BYTES) return TEXT_TOO_BIG_MESSAGE;
  return undefined;
}

/**
 * The text in these bytes when they are plain UTF-8 text within 1 MB, or undefined: a
 * program or a page renamed to .txt has invalid bytes or control characters.
 */
export function plainText(bytes: Uint8Array): string | undefined {
  if (bytes.byteLength > CHAT_TEXT_MAX_BYTES) return undefined;
  try {
    const text = strictUtf8.decode(bytes);
    if (CONTROL_CHARACTER.test(text)) return undefined;
    return text;
  } catch {
    return undefined;
  }
}

/** The message for a picked file whose bytes are not plain text. */
export function notPlainTextMessage(): string {
  return NOT_PLAIN_TEXT_MESSAGE;
}

/**
 * A name safe to show and to save: no folders, no control characters, no second extension
 * ("nota.txt.exe" keeps no ".exe"), at most 80 characters, always ending in ".txt".
 */
export function cleanTextFileName(name: string): string {
  // Both Windows and Unix folder separators.
  const last = name.split(/[\\/]/u).at(-1) ?? "";
  const base = last
    .replace(CONTROL_CHARACTERS, "")
    .trim()
    .replace(/\.txt$/iu, "")
    .replaceAll(".", "_");
  const kept = base.slice(0, NAME_MAX_LENGTH - ".txt".length) || "arquivo";
  return `${kept}.txt`;
}

/** The first lines, each one short, as the card shows them before "Baixar". */
export function textPreview(text: string): string {
  return text
    .split(/\r?\n/u)
    .slice(0, PREVIEW_LINES)
    .map((line) => line.slice(0, PREVIEW_LINE_LENGTH))
    .join("\n");
}
