import { join } from "node:path";
import { appUrl, getEnv } from "@/server/env.server";
import {
  createLocalDiskStorage,
  type LocalDiskStorage,
} from "@/server/storage/local-disk-storage.server";
import type { ObjectStorage } from "@/server/storage/object-storage.server";
import { createR2Storage, r2Origin } from "@/server/storage/r2-storage.server";

let local: LocalDiskStorage | undefined;
let r2: ObjectStorage | undefined;

/**
 * The local disk, when it is the storage: outside production, or with
 * `ATTACHMENTS_STORAGE=local` (the E2E). The app serves its signed links itself.
 */
export function localAttachmentStorage(): LocalDiskStorage | null {
  const env = getEnv();
  if (env.ATTACHMENTS_STORAGE === "r2") return null;
  const useLocal = env.ATTACHMENTS_STORAGE === "local" || process.env.NODE_ENV !== "production";
  if (!useLocal) return null;
  local ??= createLocalDiskStorage({
    root: join(process.cwd(), ".data", "attachments"),
    secret: env.AUTH_SECRET,
    baseUrl: appUrl(),
  });
  return local;
}

/**
 * The storage for message attachments (ADR 0011): R2 with `ATTACHMENTS_STORAGE=r2`, the
 * local disk in development and the E2E, or `null` when attachments are off.
 */
export function attachmentStorage(): ObjectStorage | null {
  const env = getEnv();
  if (env.ATTACHMENTS_STORAGE !== "r2") return localAttachmentStorage();
  // The environment check at boot guarantees the four variables with "r2".
  if (
    env.R2_ACCOUNT_ID === undefined ||
    env.R2_ACCESS_KEY_ID === undefined ||
    env.R2_SECRET_ACCESS_KEY === undefined ||
    env.R2_BUCKET === undefined
  ) {
    return null;
  }
  r2 ??= createR2Storage({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
  });
  return r2;
}

/** The bucket's origin for the Content-Security-Policy, only when R2 is the storage. */
export function attachmentStorageOrigin(): string | undefined {
  const env = getEnv();
  if (env.ATTACHMENTS_STORAGE !== "r2" || env.R2_ACCOUNT_ID === undefined) return undefined;
  return r2Origin(env.R2_ACCOUNT_ID);
}
