import { afterEach, expect, test, vi } from "vitest";
import { OFFLINE_MESSAGE, operation } from "@/lib/operations/operation";

/** A request that never reaches the server answers with a message, never a thrown error. */
afterEach(() => {
  vi.unstubAllGlobals();
});

const save = operation<{ name: string }, { ok: true }>("account-save");

test("offline, the person is told the connection is down", async () => {
  vi.stubGlobal("navigator", { onLine: false });
  vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
  await expect(save({ name: "Ana" })).resolves.toEqual({ serverError: OFFLINE_MESSAGE });
});

test("online, a failed request is the generic failure", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
  const result = await save({ name: "Ana" });
  expect(result.serverError).toBe("Algo deu errado. Tente de novo.");
});
