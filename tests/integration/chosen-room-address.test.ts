import { afterAll, beforeEach, expect, test } from "vitest";
import { createAuditRecorder } from "@/server/audit.server";
import { closeDb, getDb } from "@/server/db/index.server";
import { rooms } from "@/server/db/schema/rooms";
import { mutateWorkspaceRoom } from "@/features/rooms/server/room-mutations.server";
import type { RoomWorkspaceCommand } from "@/features/rooms/domain/commands";
import { beta, roomChange } from "./support/workspaces";
import { account, mockControlTransport } from "./support/host-controls";

process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function create(code: string | undefined): Extract<RoomWorkspaceCommand, { kind: "create" }> {
  return {
    kind: "create",
    name: "Sala com endereço",
    code,
    allowGuests: true,
    memberCanHost: false,
  };
}

async function proAccount() {
  const actor = await account();
  await beta(actor, "account", true, 5);
  return actor;
}

test("a permanent room takes the address its owner chose, or a drawn one without it", async () => {
  const actor = await proAccount();
  const code = `reuniao-${unique()}`;
  expect((await roomChange(actor, create(code))).code).toBe(code);
  expect((await roomChange(actor, create(undefined))).code).toMatch(/^sala-[a-z0-9]{24}$/);
});

test("an address that ever named a room is refused, permanent or for one call", async () => {
  const actor = await proAccount();
  const taken = `ocupada-${unique()}`;
  await roomChange(actor, create(taken));
  await expect(roomChange(actor, create(taken))).rejects.toThrow(
    "Esse endereço já está em uso. Escolha outro.",
  );
  const callCode = `chamada-${unique()}`;
  await getDb().insert(rooms).values({ code: callCode });
  await expect(roomChange(actor, create(callCode))).rejects.toThrow("já está em uso");
});

test("two people choosing the same address at once: only one gets it", async () => {
  const [first, second] = [await proAccount(), await proAccount()];
  const code = `disputa-${unique()}`;
  const results = await Promise.allSettled([
    roomChange(first, create(code)),
    roomChange(second, create(code)),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
});

test("a reserved word needs the owner's permission", async () => {
  const actor = await proAccount();
  const code = `nelcota-${unique()}`;
  await expect(roomChange(actor, create(code))).rejects.toThrow(
    "Esse endereço não pode ser usado.",
  );
  const allowed = await mutateWorkspaceRoom(
    getDb(),
    actor,
    create(code),
    createAuditRecorder({ userId: actor }),
    { mayUseReservedWords: true },
  );
  expect(allowed.code).toBe(code);
});
