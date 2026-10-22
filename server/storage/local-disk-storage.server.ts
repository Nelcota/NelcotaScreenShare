import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import {
  attachmentDisposition,
  isObjectKey,
  uploadHeaders,
  type ObjectStorage,
  type StoredObject,
  type UploadLink,
  type UploadOptions,
} from "./object-storage.server";
import { signStorageGrant, verifyStorageGrant } from "./storage-links.server";

/** Where the app answers the local links (the routes come with the attachments' API). */
const UPLOAD_PATH = "/api/arquivos/envio";
const DOWNLOAD_PATH = "/api/arquivos/baixar";

export interface LocalDiskStorageOptions {
  /** Folder that holds the files (development: `.data/attachments`). */
  root: string;
  /** Signs the links, like R2 signs its own. */
  secret: string;
  /** The app's address, so the links point back at it. */
  baseUrl: string;
  now?: () => number;
}

/** A download served by the app in development: the file and the headers R2 would send. */
interface LocalDownload {
  stream: Readable;
  size: number;
  disposition: string;
}

export interface LocalDiskStorage extends ObjectStorage {
  /** Writes the body a signed upload link sends; `false` when the link is not valid. */
  acceptUpload(token: string, body: Readable): Promise<boolean>;
  /** Opens the file a signed download link names; `null` when the link or file is not valid. */
  openDownload(token: string): Promise<LocalDownload | null>;
}

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** The saved Content-Disposition; an attachment named "arquivo" when it is missing. */
async function readDisposition(path: string): Promise<string> {
  try {
    return await readFile(`${path}.disposition`, "utf8");
  } catch (error) {
    if (missing(error)) return attachmentDisposition("arquivo");
    throw error;
  }
}

/**
 * The development adapter of ADR 0011: files on the local disk, links signed with the app's
 * secret and served by the app itself, so the whole flow runs without a cloud account.
 */
export function createLocalDiskStorage(options: LocalDiskStorageOptions): LocalDiskStorage {
  const now = options.now ?? Date.now;

  function pathOf(key: string): string {
    if (!isObjectKey(key)) throw new TypeError(`Not an attachment key: ${key}`);
    return join(options.root, key);
  }

  function link(path: string, token: string): string {
    return new URL(`${path}/${token}`, options.baseUrl).toString();
  }

  async function head(key: string): Promise<StoredObject | null> {
    try {
      const file = await stat(pathOf(key));
      return { size: file.size };
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  return {
    async uploadLink(key: string, upload: UploadOptions): Promise<UploadLink> {
      pathOf(key);
      const expiresAt = now() + upload.expiresInSeconds * 1000;
      const grant = { action: "upload", key, fileName: upload.fileName, expiresAt } as const;
      const url = link(UPLOAD_PATH, signStorageGrant(options.secret, grant));
      return { url, headers: uploadHeaders(upload.fileName) };
    },

    async downloadUrl(key: string, expiresInSeconds: number): Promise<string> {
      pathOf(key);
      const grant = {
        action: "download",
        key,
        expiresAt: now() + expiresInSeconds * 1000,
      } as const;
      return link(DOWNLOAD_PATH, signStorageGrant(options.secret, grant));
    },

    head,

    async readStart(key: string, bytes: number): Promise<Uint8Array> {
      const file = await open(pathOf(key), "r");
      try {
        const buffer = Buffer.alloc(bytes);
        const { bytesRead } = await file.read(buffer, 0, bytes, 0);
        return buffer.subarray(0, bytesRead);
      } finally {
        await file.close();
      }
    },

    async remove(key: string): Promise<void> {
      await rm(pathOf(key), { force: true });
      await rm(`${pathOf(key)}.disposition`, { force: true });
    },

    async acceptUpload(token: string, body: Readable): Promise<boolean> {
      const grant = verifyStorageGrant(token, options.secret, "upload", now());
      if (grant === null || !isObjectKey(grant.key)) return false;
      const path = pathOf(grant.key);
      await mkdir(dirname(path), { recursive: true });
      await pipeline(body, createWriteStream(path));
      // Stands in for the Content-Disposition R2 keeps with the object.
      await writeFile(`${path}.disposition`, attachmentDisposition(grant.fileName ?? "arquivo"));
      return true;
    },

    async openDownload(token: string): Promise<LocalDownload | null> {
      const grant = verifyStorageGrant(token, options.secret, "download", now());
      if (grant === null || !isObjectKey(grant.key)) return null;
      const found = await head(grant.key);
      if (found === null) return null;
      const path = pathOf(grant.key);
      const disposition = await readDisposition(path);
      return { stream: createReadStream(path), size: found.size, disposition };
    },
  };
}
