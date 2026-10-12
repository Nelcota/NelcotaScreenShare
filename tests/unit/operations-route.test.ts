import { RouterContextProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { requestHeaders } from "@/server/request-context.server";

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("@/app/operations.server", () => ({
  operations: {
    "auth-acceptInvitation": { handle },
    "account-revokeMySession": { handle },
    "team-teamWorkspaceAction": { handle },
    "admin-search-searchPanelAction": { handle },
  },
  readOperations: new Set(["admin-search-searchPanelAction"]),
}));
const { action } = await import("@/app/routes/api/operations");

beforeEach(() => {
  handle.mockReset();
  vi.stubEnv("APP_URL", "http://localhost");
});

test("team acceptance redirects before its single-use invitation is revalidated", async () => {
  const teamId = crypto.randomUUID();
  handle.mockResolvedValue({ data: { teamId } });
  const accepted = await dispatch("team-teamWorkspaceAction", {
    body: JSON.stringify({ input: { kind: "accept", token: "invitation" } }),
  });
  expect(accepted.status).toBe(303);
  expect(accepted.headers.get("Location")).toBe(`/times/${teamId}`);
  const invite = await dispatch("team-teamWorkspaceAction", {
    body: JSON.stringify({ input: { kind: "invite" } }),
  });
  expect(invite.status).toBe(200);
  expect(await invite.json()).toEqual({ data: { teamId } });
});

function dispatch(id: string, init?: RequestInit) {
  return action({
    request: new Request(`http://localhost/api/operations/${id}`, {
      method: "POST",
      headers: { origin: "http://localhost" },
      body: '{"input":{"token":"convite"}}',
      ...init,
    }),
    params: { operation: id },
    url: new URL(`http://localhost/api/operations/${id}`),
    pattern: "/api/operations/:operation",
    context: new RouterContextProvider(),
  });
}

test("unknown operations or wrong methods do not run the operation", async () => {
  expect((await dispatch("toString")).status).toBe(404);
  const response = await dispatch("auth-acceptInvitation", { method: "GET", body: undefined });
  expect(response.status).toBe(405);
  expect(response.headers.get("Allow")).toBe("POST");
  expect(handle).not.toHaveBeenCalled();
});

test("cross-origin POST is rejected before the operation", async () => {
  expect(
    (await dispatch("auth-acceptInvitation", { headers: { origin: "https://outro.example" } }))
      .status,
  ).toBe(403);
  expect(handle).not.toHaveBeenCalled();
});

test("invalid JSON and oversized body do not run the operation", async () => {
  expect((await dispatch("auth-acceptInvitation", { body: "[" })).status).toBe(400);
  expect(
    (await dispatch("auth-acceptInvitation", { body: "x".repeat(1024 * 1024 + 1) })).status,
  ).toBe(413);
  expect(handle).not.toHaveBeenCalled();
});

test("accepting an invitation redirects on the server before page revalidation", async () => {
  handle.mockImplementation(async () => {
    expect(requestHeaders().get("origin")).toBe("http://localhost");
    return { data: { accepted: true } };
  });
  const response = await dispatch("auth-acceptInvitation");
  expect(response.status).toBe(303);
  expect(response.headers.get("Location")).toBe("/admin/entrar?aviso=convite");
  expect(handle).toHaveBeenCalledWith({ token: "convite" });
});

test("validation errors stay on the form and responses are not cached", async () => {
  handle.mockResolvedValue({ serverError: "Convite expirado." });
  const response = await dispatch("auth-acceptInvitation");
  expect(response.headers.get("Location")).toBeNull();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ serverError: "Convite expirado." });
});
