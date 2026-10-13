import { expect, it } from "vitest";
import { parseRoomRole } from "@/features/room/domain/room-role";

it("reads the role attribute, treating missing or unknown values as participant", () => {
  expect(parseRoomRole("owner")).toBe("owner");
  expect(parseRoomRole("moderator")).toBe("moderator");
  expect(parseRoomRole("participant")).toBe("participant");
  expect(parseRoomRole(undefined)).toBe("participant");
  expect(parseRoomRole("admin")).toBe("participant");
  expect(parseRoomRole("")).toBe("participant");
});
