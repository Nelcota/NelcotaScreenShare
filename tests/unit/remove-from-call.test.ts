import { afterEach, expect, test, vi } from "vitest";
import { removeFromCall } from "@/features/room/client/api";

vi.mock("@/lib/telemetry.client", () => ({ logBrowserWarning: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

test("sends kick or ban for that person and accepts an empty success", async () => {
  const fetch = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  expect(await removeFromCall("abc-defg-hij", "pessoa-1", "ban")).toEqual({ ok: true });
  const [, init] = fetch.mock.calls[0] ?? [];
  const sent = typeof init?.body === "string" ? init.body : "{}";
  expect(JSON.parse(sent)).toEqual({
    room: "abc-defg-hij",
    identity: "pessoa-1",
    action: "ban",
  });
});

test("keeps the server's message, and falls back on a network or odd reply", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  fetch.mockResolvedValueOnce(
    Response.json({ message: "Você não pode tirar essa pessoa." }, { status: 403 }),
  );
  expect(await removeFromCall("sala", "x", "kick")).toEqual({
    ok: false,
    message: "Você não pode tirar essa pessoa.",
  });
  fetch.mockResolvedValueOnce(new Response("<html>proxy</html>", { status: 502 }));
  expect(await removeFromCall("sala", "x", "kick")).toMatchObject({ ok: false });
  fetch.mockRejectedValueOnce(new Error("offline"));
  expect(await removeFromCall("sala", "x", "kick")).toMatchObject({ ok: false });
});
