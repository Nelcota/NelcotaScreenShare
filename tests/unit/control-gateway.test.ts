import { expect, test, vi } from "vitest";
import { controlGateway } from "@/features/room/server/control-gateway.server";
import type { ControlSession } from "@/features/room/server/session-store.server";

interface UpdateOptions {
  attributes: Record<string, string>;
}

const listParticipants = vi.hoisted(() => vi.fn());
const updateParticipant = vi.hoisted(() =>
  vi.fn<(room: string, identity: string, options: UpdateOptions) => Promise<object>>(),
);
vi.mock("@/features/room/server/room-service.server", () => ({
  roomService: () => ({ listParticipants, updateParticipant }),
}));

test("a sync publishes the role saved for each person", async () => {
  listParticipants.mockResolvedValue([{ identity: "ana" }, { identity: "convidado-1" }]);
  updateParticipant.mockResolvedValue({});
  const session = {
    mediaRoomName: "nelcota-sessao",
    hostUserId: "ana",
    sharePolicy: "everyone",
    allowedSharers: [],
  } as unknown as ControlSession;

  await controlGateway.sync(session, new Map([["ana", "owner"]]));

  const roleOf = (identity: string) =>
    updateParticipant.mock.calls.find((call) => call[1] === identity)?.[2].attributes.role;
  expect(roleOf("ana")).toBe("owner");
  expect(roleOf("convidado-1")).toBe("participant");
});
