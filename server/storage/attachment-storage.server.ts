import { join } from "node:path";
import { appUrl, getEnv } from "@/server/env.server";
import {
  createLocalDiskStorage,
  type LocalDiskStorage,
} from "@/server/storage/local-disk-storage.server";

let local: LocalDiskStorage | undefined;

/**
 * The storage for message attachments (ADR 0011), or `null` when attachments are off: in
 * production until its storage is configured. Outside production, and with
 * `ATTACHMENTS_STORAGE=local`, the files stay on this machine's disk.
 */
export function attachmentStorage(): LocalDiskStorage | null {
  const env = getEnv();
  const useLocal = env.ATTACHMENTS_STORAGE === "local" || process.env.NODE_ENV !== "production";
  if (!useLocal) return null;
  local ??= createLocalDiskStorage({
    root: join(process.cwd(), ".data", "attachments"),
    secret: env.AUTH_SECRET,
    baseUrl: appUrl(),
  });
  return local;
}
