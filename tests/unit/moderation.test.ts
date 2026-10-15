import { expect, it } from "vitest";
import { canModerate } from "@/features/room/domain/moderation";

it("the owner removes anyone else; a moderator only participants; participants nobody", () => {
  expect(canModerate("owner", "moderator")).toBe(true);
  expect(canModerate("owner", "participant")).toBe(true);
  expect(canModerate("owner", "owner")).toBe(false);
  expect(canModerate("moderator", "participant")).toBe(true);
  expect(canModerate("moderator", "moderator")).toBe(false);
  expect(canModerate("moderator", "owner")).toBe(false);
  expect(canModerate("participant", "participant")).toBe(false);
  expect(canModerate("participant", "owner")).toBe(false);
});
