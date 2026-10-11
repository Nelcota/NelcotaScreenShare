import { expect, test, vi } from "vitest";
import { createFaceRenderer } from "@/features/mascot/client/face-renderer";
import { IDLE } from "@/features/mascot/domain/eye-tracking";

test("blinking keeps the body pose, while deliberately closed eyes retain their pose", () => {
  const properties = new Map<string, string>();
  const face = {
    querySelector: () => ({ querySelectorAll: () => [] }),
    closest: () => ({ dataset: { expression: "celebrate" } }),
    style: { setProperty: vi.fn((name: string, value: string) => properties.set(name, value)) },
  } as unknown as HTMLElement;
  const renderer = createFaceRenderer(face);
  if (!renderer) throw new Error("Missing face renderer");
  const closedEyes = { tilt: 0, pupil: 1, lid0: 1, lid1: 1, rest: 0 };
  renderer.render(IDLE, closedEyes, { lid0: 0, lid1: 0 });
  expect(properties.get("--sprite-column")).toBe("1");
  expect(properties.get("--sprite-row")).toBe("0");
  renderer.render(IDLE, closedEyes);
  expect(properties.get("--sprite-column")).toBe("0");
  expect(properties.get("--sprite-row")).toBe("1");
});

test("a blink retains the closed-eye pose it started with", () => {
  const properties = new Map<string, string>();
  const face = {
    querySelector: () => ({ querySelectorAll: () => [] }),
    closest: () => ({ dataset: { expression: "celebrate" } }),
    style: { setProperty: (name: string, value: string) => properties.set(name, value) },
  } as unknown as HTMLElement;
  const renderer = createFaceRenderer(face);
  if (!renderer) throw new Error("Missing face renderer");
  const state = { tilt: 0, pupil: 1, lid0: 1, lid1: 1, rest: 0 };
  renderer.render(IDLE, state, { lid0: 0.95, lid1: 0.95 });
  expect(properties.get("--sprite-column")).toBe("0");
  expect(properties.get("--sprite-row")).toBe("1");
});
