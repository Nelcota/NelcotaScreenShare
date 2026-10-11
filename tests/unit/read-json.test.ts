import { beforeEach, expect, test, vi } from "vitest";
import { readJson } from "@/lib/read-json";

const warning = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry.client", () => ({ logBrowserWarning: warning }));
beforeEach(() => vi.clearAllMocks());

test.each([{ name: "Updated account" }, [1, 2], null, false, 0])(
  "reads valid JSON without claiming a transport or application error",
  async (payload) => {
    expect(await readJson(Response.json(payload))).toEqual(payload);
    expect(warning).not.toHaveBeenCalled();
  },
);

test.each([
  new Response("<html>Proxy unavailable</html>", {
    status: 502,
    headers: { "content-type": "text/html" },
  }),
  new Response(null, { status: 204 }),
  new Response('{"incomplete":'),
])("non-JSON replies fail safely instead of crashing the account action", async (response) => {
  expect(await readJson(response)).toBeNull();
  expect(warning).toHaveBeenCalledExactlyOnceWith(
    "Response body is not JSON",
    expect.any(SyntaxError),
  );
});

test("a response whose body was already consumed reports the read failure", async () => {
  const response = Response.json({ name: "Updated account" });
  await response.text();
  expect(await readJson(response)).toBeNull();
  expect(warning).toHaveBeenCalledExactlyOnceWith(
    "Response body is not JSON",
    expect.any(TypeError),
  );
});
