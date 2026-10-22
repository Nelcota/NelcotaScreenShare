import { AwsClient } from "aws4fetch";
import {
  isObjectKey,
  uploadHeaders,
  type ObjectStorage,
  type StoredObject,
  type UploadLink,
  type UploadOptions,
} from "./object-storage.server";

/** A server-side call to R2 never waits longer than this. */
const REQUEST_TIMEOUT_MS = 15_000;

export interface R2Options {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Tests pass a fake; the app uses the global fetch. */
  fetch?: typeof fetch;
}

/** A call to R2 that answered with something other than what the operation expects. */
export class StorageError extends Error {
  constructor(operation: string, status: number) {
    super(`R2 ${operation} answered ${status}`);
    this.name = "StorageError";
  }
}

/**
 * At most the first bytes of a response, stopping the stream there: a server that ignored
 * Range would otherwise send (and make the app hold) the whole file.
 */
async function readFirstBytes(response: Response, bytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (reader === undefined) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let read = 0;
  while (read < bytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    read += value.length;
  }
  await reader.cancel();
  const all = new Uint8Array(read);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return all.subarray(0, bytes);
}

/** The bucket's origin, for the Content-Security-Policy (uploads and photo previews). */
export function r2Origin(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

/**
 * The production adapter of ADR 0011: Cloudflare R2 through its S3 API, signed with
 * `aws4fetch`. The browser uploads and downloads with presigned links; the server only
 * measures, reads the first bytes and deletes.
 */
export function createR2Storage(options: R2Options): ObjectStorage {
  const client = new AwsClient({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const send = options.fetch ?? fetch;
  const bucketUrl = `${r2Origin(options.accountId)}/${options.bucket}`;

  function objectUrl(key: string): URL {
    if (!isObjectKey(key)) throw new TypeError(`Not an attachment key: ${key}`);
    return new URL(`${bucketUrl}/${key}`);
  }

  /**
   * A link the browser can use for this method until it expires. Every header given is
   * signed, Content-Length included: an upload of another size is refused by R2.
   */
  async function presign(
    method: "GET" | "PUT",
    key: string,
    expiresInSeconds: number,
    headers: Record<string, string> = {},
  ): Promise<string> {
    const url = objectUrl(key);
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    const signed = await client.sign(new Request(url, { method, headers }), {
      aws: { signQuery: true, allHeaders: true },
    });
    return signed.url;
  }

  /** A signed call from the server, bounded in time. */
  async function call(method: string, key: string, headers: Record<string, string> = {}) {
    const signed = await client.sign(new Request(objectUrl(key), { method, headers }));
    return send(signed, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }

  return {
    async uploadLink(key: string, upload: UploadOptions): Promise<UploadLink> {
      const headers = uploadHeaders(upload.fileName);
      // The browser sets Content-Length itself; it is signed but not handed back to send.
      const signed = { ...headers, "Content-Length": String(upload.size) };
      return { url: await presign("PUT", key, upload.expiresInSeconds, signed), headers };
    },

    downloadUrl: (key: string, expiresInSeconds: number) => presign("GET", key, expiresInSeconds),

    async head(key: string): Promise<StoredObject | null> {
      const response = await call("HEAD", key);
      if (response.status === 404) return null;
      if (!response.ok) throw new StorageError("HEAD", response.status);
      const size = Number(response.headers.get("content-length"));
      if (!Number.isSafeInteger(size) || size < 0) throw new StorageError("HEAD", response.status);
      return { size };
    },

    async readStart(key: string, bytes: number): Promise<Uint8Array> {
      const response = await call("GET", key, { Range: `bytes=0-${bytes - 1}` });
      if (!response.ok) throw new StorageError("GET", response.status);
      return readFirstBytes(response, bytes);
    },

    async remove(key: string): Promise<void> {
      const response = await call("DELETE", key);
      if (response.ok || response.status === 404) return;
      throw new StorageError("DELETE", response.status);
    },
  };
}
