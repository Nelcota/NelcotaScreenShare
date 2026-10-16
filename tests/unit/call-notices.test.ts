import { beforeEach, expect, test, vi } from "vitest";

const sonner = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  });
  return { toast };
});
vi.mock("sonner", () => sonner);
const { callToast, setCallToasterShown } = await import("@/features/room/client/call-notices");

beforeEach(() => {
  vi.clearAllMocks();
  setCallToasterShown(false);
});

test("in the open call, messages go to its toaster; minimized, to the app's", () => {
  setCallToasterShown(true);
  callToast.error("Falhou");
  expect(sonner.toast.error).toHaveBeenLastCalledWith(
    "Falhou",
    expect.objectContaining({ toasterId: "call" }),
  );
  setCallToasterShown(false);
  callToast.info("Saiu");
  expect(sonner.toast.info).toHaveBeenLastCalledWith(
    "Saiu",
    expect.objectContaining({ toasterId: undefined }),
  );
});

test("clicks pass through a message, but not one with a button to press", () => {
  callToast.error("Sem microfone");
  expect(sonner.toast.error).toHaveBeenLastCalledWith(
    "Sem microfone",
    expect.objectContaining({ className: "pointer-events-none" }),
  );
  callToast.error("Falhou", { action: { label: "Tentar de novo", onClick: () => {} } });
  expect(sonner.toast.error).toHaveBeenLastCalledWith(
    "Falhou",
    expect.objectContaining({ className: "" }),
  );
});
