import { ServerError } from "livekit-server-sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renameInRoom } from "@/features/room/client/api";

const deps = vi.hoisted(() => ({
  caller: vi.fn(),
  updateParticipant: vi.fn(),
  updateUser: vi.fn(),
  logError: vi.fn(),
  logBrowserWarning: vi.fn(),
}));
vi.mock("@/lib/telemetry.client", () => ({ logBrowserWarning: deps.logBrowserWarning }));

vi.mock("@/features/room/server/room-caller.server", () => ({ roomCaller: deps.caller }));
vi.mock("@/features/room/server/room-service.server", () => ({
  roomService: () => ({ updateParticipant: deps.updateParticipant }),
}));
vi.mock("@/features/auth/server/participant-auth.server", () => ({
  getUserAuth: () => ({ api: { updateUser: deps.updateUser } }),
}));
vi.mock("@/server/request-log.server", () => ({
  requestLogger: () => ({ error: deps.logError }),
}));

const { setRoomName } = await import("../../features/room/server/name-route.server");

const ROOM = "abc-defg-hij";
let callerCount = 0;

/** Each test renames a different person, so the per-identity limit never interferes. */
function asCaller(kind: "account" | "guest") {
  callerCount += 1;
  const identity = kind === "guest" ? `convidado-${callerCount}` : `conta-${callerCount}`;
  deps.caller.mockResolvedValue({ kind, identity });
  return identity;
}

function rename(body: unknown) {
  return setRoomName(
    new Request("http://localhost/api/sala/nome", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.updateParticipant.mockResolvedValue({});
  deps.updateUser.mockResolvedValue({ status: true });
});
afterEach(() => vi.unstubAllGlobals());

test("the client does not report a successful rename for an HTML response or a missing name", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  fetch.mockResolvedValueOnce(new Response("<html>Proxy page</html>"));
  expect(await renameInRoom(ROOM, "Ana")).toMatchObject({ ok: false });
  fetch.mockResolvedValueOnce(Response.json({}));
  expect(await renameInRoom(ROOM, "Ana")).toMatchObject({ ok: false });
  fetch.mockResolvedValueOnce(Response.json({ name: "   " }));
  expect(await renameInRoom(ROOM, "Ana")).toMatchObject({ ok: false });
});

test("the client accepts the validated name and preserves the server's error message", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  fetch.mockResolvedValueOnce(Response.json({ name: "Ana Souza" }));
  expect(await renameInRoom(ROOM, "Ana")).toEqual({ ok: true, name: "Ana Souza" });
  fetch.mockResolvedValueOnce(
    Response.json({ message: "Você não está nesta sala." }, { status: 409 }),
  );
  expect(await renameInRoom(ROOM, "Ana")).toEqual({
    ok: false,
    message: "Você não está nesta sala.",
  });
});

test("the client reports a network failure without treating the name as saved", async () => {
  const error = new TypeError("Failed to fetch");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
  expect(await renameInRoom(ROOM, "Ana")).toMatchObject({ ok: false });
  expect(deps.logBrowserWarning).toHaveBeenCalledWith("Room rename request failed", error);
});

test("an account renames itself in the room and keeps the name", async () => {
  const identity = asCaller("account");
  const response = await rename({ room: ROOM, name: "  Ana Souza " });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ name: "Ana Souza" });
  expect(deps.updateParticipant).toHaveBeenCalledWith(ROOM, identity, { name: "Ana Souza" });
  expect(deps.updateUser).toHaveBeenCalledWith(
    expect.objectContaining({ body: { name: "Ana Souza" } }),
  );
});

test("a guest renames itself only in the room", async () => {
  const identity = asCaller("guest");
  const response = await rename({ room: ROOM, name: "Bruno" });
  expect(response.status).toBe(200);
  expect(deps.updateParticipant).toHaveBeenCalledWith(ROOM, identity, { name: "Bruno" });
  expect(deps.updateUser).not.toHaveBeenCalled();
});

test("without a session or guest cookie nothing changes", async () => {
  deps.caller.mockResolvedValue(undefined);
  const response = await rename({ room: ROOM, name: "Ana" });
  expect(response.status).toBe(401);
  expect(deps.updateParticipant).not.toHaveBeenCalled();
});

test("an empty or too long name is refused with the reason", async () => {
  asCaller("account");
  const empty = await rename({ room: ROOM, name: "   " });
  expect(empty.status).toBe(400);
  expect(await empty.json()).toEqual({ message: "Digite seu nome para entrar na sala." });
  const long = await rename({ room: ROOM, name: "x".repeat(33) });
  expect(long.status).toBe(400);
  expect(deps.updateParticipant).not.toHaveBeenCalled();
});

test("someone outside the call cannot rename and the account stays as it was", async () => {
  asCaller("account");
  deps.updateParticipant.mockRejectedValue(new ServerError("not_found", "not found", 404));
  const response = await rename({ room: ROOM, name: "Ana" });
  expect(response.status).toBe(409);
  expect(deps.updateUser).not.toHaveBeenCalled();
});

test("a LiveKit failure is logged and answered as unavailable", async () => {
  asCaller("guest");
  deps.updateParticipant.mockRejectedValue(new Error("down"));
  const response = await rename({ room: ROOM, name: "Ana" });
  expect(response.status).toBe(502);
  expect(deps.logError).toHaveBeenCalledOnce();
});

test("too many renames in a minute are refused", async () => {
  asCaller("guest");
  for (let attempt = 0; attempt < 10; attempt += 1) await rename({ room: ROOM, name: "Ana" });
  const response = await rename({ room: ROOM, name: "Ana" });
  expect(response.status).toBe(429);
});
