import { expect, test } from "vitest";
import { participantPhotoPath } from "@/features/room/domain/participant-photo";
import { photoBytesFromDataUrl } from "@/features/room/server/participant-photo.server";

test("an account's photo is asked for by room and person; a guest has none", () => {
  expect(participantPhotoPath("abc-defg-hij", "0199c6f0-0000-7000-8000-000000000001")).toBe(
    "/api/sala/foto?sala=abc-defg-hij&pessoa=0199c6f0-0000-7000-8000-000000000001",
  );
  expect(participantPhotoPath("abc-defg-hij", "convidado-123")).toBeNull();
});

test("only a non-empty WebP data URL becomes photo bytes", () => {
  const bytes = Buffer.from("RIFF....WEBP");
  expect(photoBytesFromDataUrl(`data:image/webp;base64,${bytes.toString("base64")}`)).toEqual(
    new Uint8Array(bytes),
  );
  expect(photoBytesFromDataUrl(null)).toBeNull();
  expect(photoBytesFromDataUrl("data:image/webp;base64,")).toBeNull();
  expect(photoBytesFromDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
  expect(photoBytesFromDataUrl("https://example.com/photo.webp")).toBeNull();
});
