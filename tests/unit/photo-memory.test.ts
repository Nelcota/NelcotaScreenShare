import { expect, test } from "vitest";
import { createPhotoMemory } from "@/components/photo-memory";

const photo = "/api/amigos/foto?pessoa=caio";

/**
 * The column had Caio's photo; a request for it failed while the server restarted; the ring
 * card drawn next showed only "CT" for a minute.
 */
test("a photo that loaded on the page is not given up by a later failed request", () => {
  const memory = createPhotoMemory(() => 0);
  memory.markLoaded(photo);
  memory.markMissing(photo);
  expect(memory.isMissing(photo)).toBe(false);
});

test("a photo that never loaded is not asked again for a minute", () => {
  let now = 0;
  const memory = createPhotoMemory(() => now);
  memory.markMissing(photo);
  expect(memory.isMissing(photo)).toBe(true);
  now = 60_001;
  expect(memory.isMissing(photo)).toBe(false);
});
