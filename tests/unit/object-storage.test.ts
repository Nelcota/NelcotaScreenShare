import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createLocalDiskStorage } from "@/server/storage/local-disk-storage.server";
import {
  attachmentDisposition,
  isObjectKey,
  newObjectKey,
} from "@/server/storage/object-storage.server";
import { signStorageGrant, verifyStorageGrant } from "@/server/storage/storage-links.server";

const SECRET = "segredo-dos-arquivos-de-teste-0123456789abcdef";
const NOW = 1_800_000_000_000;

/** The token at the end of a local storage link. */
function tokenOf(url: string): string {
  return new URL(url).pathname.split("/").at(-1) ?? "";
}

describe("object keys", () => {
  test("only random keys under attachments/ are accepted", () => {
    expect(isObjectKey(newObjectKey())).toBe(true);
    for (const key of ["../etc/passwd", "attachments/../../x", "attachments/abc", "outra/coisa"]) {
      expect(isObjectKey(key), key).toBe(false);
    }
  });

  test("the download is always an attachment, with any name encoded safely", () => {
    expect(attachmentDisposition('relatório "final".pdf')).toBe(
      `attachment; filename="relat_rio _final_.pdf"; filename*=UTF-8''relat%C3%B3rio%20%22final%22.pdf`,
    );
  });
});

describe("storage links", () => {
  const grant = {
    action: "upload",
    key: newObjectKey(),
    fileName: "a.png",
    expiresAt: NOW + 60_000,
  } as const;

  test("are valid for their action until they expire", () => {
    const token = signStorageGrant(SECRET, grant);
    expect(verifyStorageGrant(token, SECRET, "upload", NOW)).toEqual(grant);
    expect(verifyStorageGrant(token, SECRET, "download", NOW)).toBeNull();
    expect(verifyStorageGrant(token, SECRET, "upload", NOW + 60_000)).toBeNull();
  });

  test("refuse another secret, a changed payload and garbage", () => {
    const token = signStorageGrant(SECRET, grant);
    const [, signature] = token.split(".");
    const forged = signStorageGrant("outro-segredo-0123456789abcdef0123456789", grant);
    const changed = `${Buffer.from(JSON.stringify({ ...grant, key: newObjectKey() })).toString("base64url")}.${signature}`;
    expect(verifyStorageGrant(forged, SECRET, "upload", NOW)).toBeNull();
    expect(verifyStorageGrant(changed, SECRET, "upload", NOW)).toBeNull();
    expect(verifyStorageGrant("lixo", SECRET, "upload", NOW)).toBeNull();
  });
});

describe("the local disk storage", () => {
  let root = "";

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "nelcota-storage-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function storage(now = NOW) {
    return createLocalDiskStorage({
      root,
      secret: SECRET,
      baseUrl: "http://localhost:3000",
      now: () => now,
    });
  }

  test("stores what a signed upload sends, measures it and reads its first bytes", async () => {
    const key = newObjectKey();
    const upload = await storage().uploadLink(key, {
      fileName: "nota.txt",
      size: 10,
      expiresInSeconds: 60,
    });

    const accepted = await storage().acceptUpload(
      tokenOf(upload.url),
      Readable.from(["olá, mundo"]),
    );

    expect(accepted).toBe(true);
    expect(await storage().head(key)).toEqual({ size: Buffer.byteLength("olá, mundo") });
    expect(Buffer.from(await storage().readStart(key, 3))).toEqual(
      Buffer.from("olá, mundo").subarray(0, 3),
    );
  });

  test("serves a signed download as an attachment, with the name given at upload", async () => {
    const key = newObjectKey();
    const upload = await storage().uploadLink(key, {
      fileName: "foto.svg",
      size: 10,
      expiresInSeconds: 60,
    });
    await storage().acceptUpload(tokenOf(upload.url), Readable.from(["<svg/>"]));

    const download = await storage().openDownload(tokenOf(await storage().downloadUrl(key, 60)));

    expect(download?.disposition).toBe(attachmentDisposition("foto.svg"));
    expect(download === null ? "" : await text(download.stream)).toBe("<svg/>");
  });

  test("an expired upload link writes nothing", async () => {
    const key = newObjectKey();
    const upload = await storage().uploadLink(key, {
      fileName: "a.txt",
      size: 10,
      expiresInSeconds: 60,
    });

    const accepted = await storage(NOW + 61_000).acceptUpload(
      tokenOf(upload.url),
      Readable.from(["x"]),
    );

    expect(accepted).toBe(false);
    expect(await storage().head(key)).toBeNull();
  });

  test("removing deletes the file, and removing again is not an error", async () => {
    const key = newObjectKey();
    const upload = await storage().uploadLink(key, {
      fileName: "a.txt",
      size: 10,
      expiresInSeconds: 60,
    });
    await storage().acceptUpload(tokenOf(upload.url), Readable.from(["x"]));

    await storage().remove(key);
    await storage().remove(key);

    expect(await storage().head(key)).toBeNull();
    expect(await storage().openDownload(tokenOf(await storage().downloadUrl(key, 60)))).toBeNull();
  });

  test("a key the app did not make never reaches the disk", async () => {
    await expect(
      storage().uploadLink("../../fora", { fileName: "a", size: 10, expiresInSeconds: 60 }),
    ).rejects.toThrow(TypeError);
    await expect(storage().remove("attachments/../../fora")).rejects.toThrow(TypeError);
  });
});
