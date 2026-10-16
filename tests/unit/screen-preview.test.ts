import { expect, test } from "vitest";
import {
  SCREEN_PREVIEW_MAX_LENGTH,
  screenPreviewSchema,
} from "@/features/room/domain/data-channel";

const frame = (image: string) => screenPreviewSchema.safeParse({ trackSid: "TR_tela", image });

test("a tiny WebP or JPEG frame is accepted", () => {
  expect(frame("data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAw").success).toBe(true);
  expect(frame("data:image/jpeg;base64,/9j/4AAQSkZJRg==").success).toBe(true);
});

test("anything else another browser might send is dropped", () => {
  expect(frame("data:image/png;base64,iVBORw0KGgo=").success).toBe(false);
  expect(frame("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=").success).toBe(false);
  expect(frame("https://exemplo.dev/tela.webp").success).toBe(false);
  expect(frame("data:image/webp;base64,<script>").success).toBe(false);
  const huge = `data:image/webp;base64,${"A".repeat(SCREEN_PREVIEW_MAX_LENGTH)}`;
  expect(frame(huge).success).toBe(false);
});
