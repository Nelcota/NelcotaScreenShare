import { beforeEach, expect, test, vi } from "vitest";
import type * as React from "react";
import type { ReactElement } from "react";

/** State that survives re-renders, so turning the sound off and on again is one person's. */
const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  microphoneEnabled: true,
  setMicrophoneEnabled: vi.fn<(enabled: boolean) => Promise<void>>(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (index >= hooks.states.length) hooks.states.push(initial);
    return [hooks.states[index], (value: unknown) => (hooks.states[index] = value)];
  },
  useRef: (initial: unknown) => {
    const index = hooks.cursor++;
    if (index >= hooks.states.length) hooks.states.push({ current: initial });
    return hooks.states[index];
  },
  useEffect: () => undefined,
}));
vi.mock("@livekit/components-react", () => ({
  useLocalParticipant: () => ({
    localParticipant: { setMicrophoneEnabled: hooks.setMicrophoneEnabled },
    isMicrophoneEnabled: hooks.microphoneEnabled,
  }),
  useRoomContext: () => ({ name: "sala-teste" }),
  RoomAudioRenderer: () => null,
}));
vi.mock("@/features/room/ui/call/RoomHostProvider", () => ({
  useRoomHost: () => ({ roomCode: "sala-teste" }),
}));
vi.mock("@/features/room/client/api", () => ({ setDeafenedInRoom: vi.fn() }));
vi.mock("@/features/room/audio/call-sounds", () => ({ playCallSound: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/features/room/ui/dock/DockButton", () => ({ DockButton: () => null }));
const { DeafenProvider } = await import("@/features/room/ui/dock/Deafen");

/** Renders the provider again with the state so far and hands back its toggle. */
function render() {
  hooks.cursor = 0;
  const provider = DeafenProvider({ children: null }) as ReactElement<{
    value: { deafened: boolean; toggle: () => Promise<void> };
  }>;
  return provider.props.value;
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.states = [];
  hooks.setMicrophoneEnabled.mockImplementation(async (enabled) => {
    hooks.microphoneEnabled = enabled;
  });
});

test("a microphone that was on goes off with the sound and comes back with it", async () => {
  hooks.microphoneEnabled = true;
  await render().toggle();
  expect(hooks.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
  expect(render().deafened).toBe(true);

  await render().toggle();
  expect(hooks.setMicrophoneEnabled).toHaveBeenLastCalledWith(true);
  expect(render().deafened).toBe(false);
  expect(hooks.microphoneEnabled).toBe(true);
});

test("a microphone that was already off stays off when the sound comes back", async () => {
  hooks.microphoneEnabled = false;
  await render().toggle();
  expect(render().deafened).toBe(true);

  await render().toggle();
  expect(render().deafened).toBe(false);
  expect(hooks.setMicrophoneEnabled).not.toHaveBeenCalled();
  expect(hooks.microphoneEnabled).toBe(false);
});
