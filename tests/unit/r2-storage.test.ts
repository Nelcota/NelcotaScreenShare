import { describe, expect, test } from "vitest";
import { attachmentDisposition, newObjectKey } from "@/server/storage/object-storage.server";
import { createR2Storage, StorageError } from "@/server/storage/r2-storage.server";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const BUCKET = "nelcota-anexos";

/** A fake R2: records each signed call and answers from a small table of objects. */
function fakeR2(objects: Record<string, string>) {
  const calls: Request[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    calls.push(request);
    const key = new URL(request.url).pathname.replace(`/${BUCKET}/`, "");
    const body = objects[key];
    if (body === undefined) return new Response(null, { status: 404 });
    if (request.method === "DELETE") return new Response(null, { status: 204 });
    const range = /bytes=0-(\d+)/.exec(request.headers.get("range") ?? "");
    const sent = range ? body.slice(0, Number(range[1]) + 1) : body;
    return new Response(request.method === "HEAD" ? null : sent, {
      status: range ? 206 : 200,
      headers: { "content-length": String(Buffer.byteLength(body)) },
    });
  };
  return { calls, fetch };
}

function storageWith(fake: ReturnType<typeof fakeR2>) {
  return createR2Storage({
    accountId: ACCOUNT,
    accessKeyId: "chave-de-teste",
    secretAccessKey: "segredo-de-teste",
    bucket: BUCKET,
    fetch: fake.fetch,
  });
}

describe("the R2 adapter", () => {
  test("signs an upload link that covers the attachment headers", async () => {
    const key = newObjectKey();
    const upload = await storageWith(fakeR2({})).uploadLink(key, {
      fileName: "relatório.pdf",
      expiresInSeconds: 900,
    });

    const url = new URL(upload.url);
    expect(url.origin).toBe(`https://${ACCOUNT}.r2.cloudflarestorage.com`);
    expect(url.pathname).toBe(`/${BUCKET}/${key}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-disposition");
    expect(upload.headers).toEqual({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": attachmentDisposition("relatório.pdf"),
    });
  });

  test("signs a short download link", async () => {
    const url = new URL(await storageWith(fakeR2({})).downloadUrl(newObjectKey(), 300));
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  test("measures, reads the first bytes and deletes with signed calls", async () => {
    const key = newObjectKey();
    const fake = fakeR2({ [key]: "%PDF-1.7 conteúdo" });
    const storage = storageWith(fake);

    expect(await storage.head(key)).toEqual({ size: Buffer.byteLength("%PDF-1.7 conteúdo") });
    expect(Buffer.from(await storage.readStart(key, 4)).toString()).toBe("%PDF");
    await storage.remove(key);

    expect(fake.calls.map((call) => call.method)).toEqual(["HEAD", "GET", "DELETE"]);
    expect(fake.calls[1]?.headers.get("range")).toBe("bytes=0-3");
    for (const call of fake.calls) {
      expect(call.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
    }
  });

  test("a missing object is null when measured, and deleting it again is not an error", async () => {
    const storage = storageWith(fakeR2({}));
    const key = newObjectKey();

    expect(await storage.head(key)).toBeNull();
    await expect(storage.remove(key)).resolves.toBeUndefined();
    await expect(storage.readStart(key, 4)).rejects.toThrow(StorageError);
  });

  test("a key the app did not make never reaches R2", async () => {
    const fake = fakeR2({});
    await expect(storageWith(fake).head("../outro-bucket/x")).rejects.toThrow(TypeError);
    expect(fake.calls).toHaveLength(0);
  });
});
