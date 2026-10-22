import assert from "node:assert/strict";
import { test } from "vitest";
import {
  admitImage,
  CHAT_IMAGE_MAX_BYTES,
  CHAT_IMAGE_MAX_SIDE,
  CHAT_IMAGE_PICK_MAX_BYTES,
  CHAT_IMAGES_PER_MINUTE,
  chatImageProblem,
  goesAsPicked,
  imageTypeOf,
  receivedCaption,
  reducedSize,
  receivedImageType,
  sendingPaceProblem,
} from "@/features/room/domain/chat-images";
import { CHAT_MAX_LENGTH } from "@/features/room/domain/data-channel";

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

test("a picked or pasted file must be an image of up to 25 MB, a GIF of up to 5 MB", () => {
  assert.equal(chatImageProblem({ type: "image/png", size: 1024 }), undefined);
  assert.equal(
    chatImageProblem({ type: "image/svg+xml", size: 1024 }),
    "Envie só imagens: PNG, JPG, WebP ou GIF.",
  );
  assert.equal(
    chatImageProblem({ type: "application/pdf", size: 10 }),
    "Envie só imagens: PNG, JPG, WebP ou GIF.",
  );
  // Bigger than what goes out is fine: the browser reduces it before sending.
  assert.equal(chatImageProblem({ type: "image/jpeg", size: CHAT_IMAGE_MAX_BYTES + 1 }), undefined);
  assert.equal(
    chatImageProblem({ type: "image/jpeg", size: CHAT_IMAGE_PICK_MAX_BYTES + 1 }),
    "A imagem passa de 25 MB.",
  );
  // A GIF is not reduced (it would stop moving), so it keeps the 5 MB that goes out.
  assert.equal(
    chatImageProblem({ type: "image/gif", size: CHAT_IMAGE_MAX_BYTES + 1 }),
    "O GIF passa de 5 MB.",
  );
});

test("only an image too heavy or too big is reduced, never enlarged", () => {
  const print = { type: "image/png", size: 800_000, width: 1920, height: 1080 };
  assert.equal(goesAsPicked(print), true);
  assert.equal(goesAsPicked({ ...print, size: CHAT_IMAGE_MAX_BYTES + 1 }), false);
  assert.equal(goesAsPicked({ ...print, width: 4000, height: 3000 }), false);
  assert.equal(goesAsPicked({ ...print, type: "image/gif", size: CHAT_IMAGE_MAX_BYTES }), true);
  assert.deepEqual(reducedSize(4000, 3000), { width: CHAT_IMAGE_MAX_SIDE, height: 1920 });
  assert.deepEqual(reducedSize(1000, 3000), { width: 853, height: CHAT_IMAGE_MAX_SIDE });
  assert.deepEqual(reducedSize(800, 600), { width: 800, height: 600 });
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

test("the sender holds back the image the others would drop, and says why", () => {
  const ten = Array.from({ length: CHAT_IMAGES_PER_MINUTE }, (_, index) => 1_000 + index);
  assert.equal(sendingPaceProblem(ten.slice(1), 2_000), undefined);
  assert.equal(sendingPaceProblem(ten, 2_000), "Espere um pouco para mandar mais imagens.");
  assert.equal(sendingPaceProblem(ten, 61_000), undefined);
});

test("the text sent with an image is held to the chat limit, and only text counts", () => {
  assert.equal(receivedCaption({ caption: "  Olha isso  " }), "Olha isso");
  assert.equal(
    receivedCaption({ caption: "a".repeat(CHAT_MAX_LENGTH + 50) }).length,
    CHAT_MAX_LENGTH,
  );
  assert.equal(receivedCaption({}), "");
  assert.equal(receivedCaption(undefined), "");
});
