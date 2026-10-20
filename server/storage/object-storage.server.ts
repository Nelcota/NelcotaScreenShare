import { randomUUID } from "node:crypto";

/** Every attachment lives under this prefix, with a random name (ADR 0011). */
const OBJECT_KEY = /^attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A new, random key: it carries no name and no personal data. */
export function newObjectKey(): string {
  return `attachments/${randomUUID()}`;
}

/** Only keys this app made are accepted, so no path can reach outside the storage. */
export function isObjectKey(value: string): boolean {
  return OBJECT_KEY.test(value);
}

/** What the server checks after an upload, before the attachment shows in a conversation. */
export interface StoredObject {
  /** The real size that arrived, in bytes. */
  size: number;
}

/** How the upload link names the file: it always downloads as an attachment. */
export interface UploadOptions {
  fileName: string;
  expiresInSeconds: number;
}

/**
 * Where attachments live (ADR 0011). R2 in production, the local disk in development; the
 * rest of the app only knows this interface. Links are short and signed: the browser sends
 * and fetches files straight from the storage.
 */
export interface ObjectStorage {
  /** A signed link the browser uses to send this one object. */
  uploadUrl(key: string, options: UploadOptions): Promise<string>;
  /** A signed link to fetch the object; the server checks who may ask for it. */
  downloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** The object's real size, or `null` when nothing arrived. */
  head(key: string): Promise<StoredObject | null>;
  /** The object's first bytes, to tell its type by content rather than by name. */
  readStart(key: string, bytes: number): Promise<Uint8Array>;
  /** Removes the object; removing one that is gone is not an error. */
  remove(key: string): Promise<void>;
}

/** `Content-Disposition` for a download: always an attachment, the name safely encoded. */
export function attachmentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
