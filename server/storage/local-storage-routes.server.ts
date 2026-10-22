import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { localAttachmentStorage } from "@/server/storage/attachment-storage.server";

const NOT_FOUND = () => new Response(null, { status: 404 });

/**
 * PUT of a signed local upload link: what R2 does in production. The size and the type are
 * checked afterwards by the server, never here.
 */
export async function localUpload(request: Request, token: string | undefined): Promise<Response> {
  const storage = localAttachmentStorage();
  if (storage === null) return NOT_FOUND();
  if (request.method !== "PUT") {
    return new Response(null, { status: 405, headers: { Allow: "PUT" } });
  }
  if (token === undefined || request.body === null) return new Response(null, { status: 400 });
  const accepted = await storage.acceptUpload(token, Readable.from(request.body));
  if (!accepted) return NOT_FOUND();
  return new Response(null, { status: 200 });
}

/**
 * GET of a signed local download link. Always an attachment, never sniffed into a page, never
 * cached: the link itself expires in minutes.
 */
export async function localDownload(token: string | undefined): Promise<Response> {
  const storage = localAttachmentStorage();
  if (storage === null || token === undefined) return NOT_FOUND();
  const download = await storage.openDownload(token);
  if (download === null) return NOT_FOUND();
  // Read whole: this adapter only runs in development and the E2E; R2 streams in production.
  const file = new Uint8Array(await buffer(download.stream));
  return new Response(file, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": download.disposition,
      "Content-Length": String(download.size),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
