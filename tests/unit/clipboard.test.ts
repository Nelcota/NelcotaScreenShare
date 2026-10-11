import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { copyText } from "@/lib/clipboard";

const notices = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: notices.success, error: notices.error } }));
vi.mock("@/lib/telemetry.client", () => ({ logBrowserWarning: notices.warning }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

test("confirms a copied invitation only after the browser accepts it", async () => {
  let finish: (() => void) | undefined;
  const writeText = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const result = copyText("https://example.com/sala/abc-defg-hij", {
    context: "Copy invitation",
    success: "Copied",
  });
  expect(notices.success).not.toHaveBeenCalled();
  if (!finish) throw new Error("The clipboard request did not start");
  finish();
  expect(await result).toBe(true);
  expect(writeText).toHaveBeenCalledWith("https://example.com/sala/abc-defg-hij");
  expect(notices.success).toHaveBeenCalledExactlyOnceWith("Copied");
  expect(notices.error).not.toHaveBeenCalled();
});

test("a refused clipboard returns failure without claiming that the invitation was copied", async () => {
  const refusal = new DOMException("Permission denied", "NotAllowedError");
  vi.stubGlobal("navigator", {
    clipboard: {
      writeText: vi.fn(async () => {
        throw refusal;
      }),
    },
  });
  expect(
    await copyText("invitation", {
      context: "Copy invitation",
      success: "Copied",
      failure: "Copy failed",
    }),
  ).toBe(false);
  expect(notices.success).not.toHaveBeenCalled();
  expect(notices.error).toHaveBeenCalledExactlyOnceWith("Copy failed");
  expect(notices.warning).toHaveBeenCalledWith("Copy invitation", refusal);
});

test("unavailable clipboard APIs are recoverable, including copies without success notices", async () => {
  vi.stubGlobal("navigator", {});
  expect(await copyText("first", { context: "Copy invitation" })).toBe(false);
  expect(notices.error).not.toHaveBeenCalled();
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(async () => {}) } });
  expect(await copyText("second", { context: "Copy invitation" })).toBe(true);
  expect(notices.success).not.toHaveBeenCalled();
});
