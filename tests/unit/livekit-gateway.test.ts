import { expect, test, vi } from "vitest";
import { liveKitGateway } from "@/features/room/server/livekit-gateway.server";

const listParticipants = vi.hoisted(() => vi.fn());
vi.mock("@/features/room/server/room-service.server", () => ({
  roomService: () => ({ listParticipants }),
}));

test("a full room reserves no additional spot for an identity already connected", async () => {
  listParticipants.mockResolvedValue([
    { identity: "ana" },
    { identity: "bia" },
    { identity: "convidado-123" },
  ]);
  expect(await liveKitGateway.countParticipants("sala", "ana")).toBe(2);
  expect(await liveKitGateway.countParticipants("sala", "convidado-123")).toBe(2);
  expect(await liveKitGateway.countParticipants("sala", "nova-pessoa")).toBe(3);
});
