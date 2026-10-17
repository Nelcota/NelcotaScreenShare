import assert from "node:assert/strict";
import { test } from "vitest";
import {
  admitImage,
  CHAT_IMAGE_MAX_BYTES,
  CHAT_IMAGES_PER_MINUTE,
  chatImageProblem,
  imageTypeOf,
  receivedImageType,
} from "@/features/room/domain/chat-images";

const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0);
const GIF = Uint8Array.of(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
const WEBP = Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);

test("the real type comes from the first bytes", () => {
  assert.equal(imageTypeOf(PNG), "image/png");
  assert.equal(imageTypeOf(JPEG), "image/jpeg");
  assert.equal(imageTypeOf(GIF), "image/gif");
  assert.equal(imageTypeOf(WEBP), "image/webp");
  // An SVG or an HTML page calling itself a PNG is not one.
  assert.equal(imageTypeOf(new TextEncoder().encode("<svg onload=alert(1)>")), undefined);
});

test("a picked or pasted file must be an image of up to 5 MB", () => {
  assert.equal(chatImageProblem({ type: "image/png", size: 1024 }), undefined);
  assert.equal(
    chatImageProblem({ type: "image/svg+xml", size: 1024 }),
    "Envie só imagens: PNG, JPG, WebP ou GIF.",
  );
  assert.equal(
    chatImageProblem({ type: "application/pdf", size: 10 }),
    "Envie só imagens: PNG, JPG, WebP ou GIF.",
  );
  assert.equal(
    chatImageProblem({ type: "image/jpeg", size: CHAT_IMAGE_MAX_BYTES + 1 }),
    "A imagem passa de 5 MB.",
  );
});

test("a received image is shown only when it is really an image within the size", () => {
  assert.equal(receivedImageType(PNG), "image/png");
  assert.equal(receivedImageType(new Uint8Array()), undefined);
  assert.equal(receivedImageType(new TextEncoder().encode("not an image")), undefined);
  const tooBig = new Uint8Array(CHAT_IMAGE_MAX_BYTES + 1);
  tooBig.set(PNG);
  assert.equal(receivedImageType(tooBig), undefined);
});

test("a person sends at most ten images a minute, and more fit as the minute passes", () => {
  const ten = Array.from({ length: CHAT_IMAGES_PER_MINUTE }, (_, index) => 1_000 + index);
  assert.deepEqual(admitImage([], 5_000), [5_000]);
  assert.equal(admitImage(ten, 2_000), undefined);
  // A minute after the first one, it no longer counts.
  assert.deepEqual(admitImage(ten, 61_000), [...ten.slice(1), 61_000]);
});
