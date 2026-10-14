import { beforeEach, expect, test, vi } from "vitest";
import type * as PhotoModule from "@/features/room/server/participant-photo.server";

const deps = vi.hoisted(() => ({
  caller: vi.fn(),
  identitiesIn: vi.fn(),
  profilePhotoOf: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("@/features/room/server/room-caller.server", () => ({ roomCaller: deps.caller }));
vi.mock("@/features/room/server/livekit-gateway.server", () => ({
  identitiesIn: deps.identitiesIn,
}));
vi.mock("@/features/room/server/participant-photo.server", async (importOriginal) => ({
  ...(await importOriginal<typeof PhotoModule>()),
  profilePhotoOf: deps.profilePhotoOf,
}));
vi.mock("@/server/db/index.server", () => ({ getDb: () => ({}) }));
vi.mock("@/server/request-log.server", () => ({
  requestLogger: () => ({ error: deps.logError }),
}));

const { participantPhoto } = await import("../../features/room/server/photo-route.server");

const PERSON = "0199c6f0-0000-7000-8000-000000000002";
let callerCount = 0;

function asNewCaller() {
  callerCount += 1;
  const identity = `0199c6f0-0000-7000-8000-${String(callerCount).padStart(12, "0")}`;
  deps.caller.mockResolvedValue({ kind: "account", identity });
  return identity;
}

function photo() {
  const query = new URLSearchParams({ sala: "abc-defg-hij", pessoa: PERSON });
  return participantPhoto(new Request(`http://localhost/api/sala/foto?${query}`));
}

beforeEach(() => vi.clearAllMocks());

test("a LiveKit failure is logged and answered with 502, without reading the photo", async () => {
  asNewCaller();
  deps.identitiesIn.mockRejectedValue(new Error("livekit down"));
  const response = await photo();
  expect(response.status).toBe(502);
  expect(deps.logError).toHaveBeenCalledOnce();
  expect(deps.profilePhotoOf).not.toHaveBeenCalled();
});

test("too many requests from one person get 429", async () => {
  const identity = asNewCaller();
  deps.identitiesIn.mockResolvedValue([identity, PERSON]);
  deps.profilePhotoOf.mockResolvedValue(null);
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 121; attempt += 1) statuses.push((await photo()).status);
  expect(statuses.slice(0, 120).every((status) => status === 204)).toBe(true);
  expect(statuses.at(-1)).toBe(429);
});
