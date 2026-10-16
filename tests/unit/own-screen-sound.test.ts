import { beforeEach, expect, test, vi, type Mock } from "vitest";
import type * as React from "react";
import type { ReactElement } from "react";

interface FakeAudio {
  isMuted: boolean;
  mute: Mock<() => Promise<void>>;
  unmute: Mock<() => Promise<void>>;
}

const sound = vi.hoisted(() => ({
  audio: undefined as FakeAudio | undefined,
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: <T>(initial: T): [T, () => void] => [initial, () => {}],
}));
vi.mock("@livekit/components-react", () => ({
  useLocalParticipant: () => ({
    localParticipant: { getTrackPublication: () => sound.audio },
  }),
}));
vi.mock("@/features/room/client/call-notices", () => ({
  callToast: { info: sound.toastInfo, error: sound.toastError },
}));
vi.mock("@/lib/telemetry.client", () => ({ reportBrowserError: sound.reportError }));

const { OwnScreenSound } = await import("@/features/room/ui/stage/OwnScreenSound");

type ButtonProps = { "aria-label": string; onClick: () => void };

function button(): ButtonProps {
  const hint = OwnScreenSound() as ReactElement<{ children: ReactElement<ButtonProps> }>;
  return hint.props.children.props;
}

async function click() {
  button().onClick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function fakeAudio(isMuted: boolean): FakeAudio {
  return {
    isMuted,
    mute: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    unmute: vi.fn<() => Promise<void>>(),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  sound.audio = undefined;
});

test("turning the sound off only mutes it", async () => {
  sound.audio = fakeAudio(false);
  expect(button()["aria-label"]).toBe("Desligar o som da tela");
  await click();
  expect(sound.audio.mute).toHaveBeenCalledOnce();
  expect(sound.audio.unmute).not.toHaveBeenCalled();
});

test("turning the sound back on does not mute it again", async () => {
  const audio = fakeAudio(true);
  audio.unmute.mockImplementation(() => {
    audio.isMuted = false;
    return Promise.resolve();
  });
  sound.audio = audio;
  expect(button()["aria-label"]).toBe("Ligar o som da tela");
  await click();
  expect(audio.unmute).toHaveBeenCalledOnce();
  expect(audio.mute).not.toHaveBeenCalled();
});

test("a screen shared without sound says how to bring it", async () => {
  expect(button()["aria-label"]).toBe("Esta tela vai sem som");
  await click();
  expect(sound.toastInfo).toHaveBeenCalledOnce();
});

test("a failure is reported and told, never swallowed", async () => {
  sound.audio = fakeAudio(false);
  sound.audio.mute.mockRejectedValue(new Error("Mute failed"));
  await click();
  expect(sound.reportError).toHaveBeenCalledOnce();
  expect(sound.toastError).toHaveBeenCalledOnce();
});
