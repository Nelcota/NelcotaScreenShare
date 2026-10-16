import { beforeEach, expect, test, vi } from "vitest";
import type { ReactElement } from "react";
import type * as React from "react";

const dependencies = vi.hoisted(() => ({
  setMicrophoneEnabled: vi.fn(),
  setDeafened: vi.fn(),
  toastError: vi.fn(),
  microphoneEnabled: true,
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: () => [false, dependencies.setDeafened],
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: () => undefined,
}));
vi.mock("@livekit/components-react", () => ({
  useLocalParticipant: () => ({
    localParticipant: { setMicrophoneEnabled: dependencies.setMicrophoneEnabled },
    isMicrophoneEnabled: dependencies.microphoneEnabled,
  }),
  RoomAudioRenderer: () => null,
  useRoomContext: () => ({ name: "sala-teste" }),
}));
vi.mock("@/features/room/ui/call/RoomHostProvider", () => ({
  useRoomHost: () => ({ roomCode: "sala-teste" }),
}));
vi.mock("@/features/room/client/api", () => ({ setDeafenedInRoom: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: dependencies.toastError } }));
vi.mock("@/features/room/ui/dock/DockButton", () => ({ DockButton: () => null }));
const { DeafenProvider } = await import("@/features/room/ui/dock/Deafen");

function toggle() {
  const provider = DeafenProvider({ children: null }) as ReactElement<{
    value: { toggle: () => Promise<void> };
  }>;
  return provider.props.value.toggle();
}

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.microphoneEnabled = true;
});

test("keeps hearing until the microphone has actually been disabled", async () => {
  let release: (() => void) | undefined;
  dependencies.setMicrophoneEnabled.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const pending = toggle();
  expect(dependencies.setMicrophoneEnabled).toHaveBeenCalledWith(false);
  expect(dependencies.setDeafened).not.toHaveBeenCalled();
  if (!release) throw new Error("Missing microphone operation");
  release();
  await pending;
  expect(dependencies.setDeafened).toHaveBeenCalledWith(true);
});

test("a microphone failure leaves room playback enabled and reports the error", async () => {
  dependencies.setMicrophoneEnabled.mockRejectedValue(new Error("Microphone unavailable"));
  await toggle();
  expect(dependencies.setDeafened).not.toHaveBeenCalledWith(true);
  expect(dependencies.setDeafened).toHaveBeenCalledWith(false);
  expect(dependencies.toastError).toHaveBeenCalledOnce();
});

test("an already disabled microphone does not require a device operation", async () => {
  dependencies.microphoneEnabled = false;
  await toggle();
  expect(dependencies.setMicrophoneEnabled).not.toHaveBeenCalled();
  expect(dependencies.setDeafened).toHaveBeenCalledWith(true);
});

test("restoring hearing supersedes a deafen operation still waiting for the microphone", async () => {
  let release: (() => void) | undefined;
  dependencies.setMicrophoneEnabled.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const provider = DeafenProvider({ children: null }) as ReactElement<{
    value: { toggle: () => Promise<void>; hearAgain: () => void };
  }>;
  const pending = provider.props.value.toggle();
  provider.props.value.hearAgain();
  if (!release) throw new Error("Missing microphone operation");
  release();
  await pending;
  expect(dependencies.setDeafened).toHaveBeenLastCalledWith(false);
});
