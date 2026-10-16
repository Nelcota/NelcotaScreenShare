import { microphoneLabel } from "./microphone-options";

type AudioInput = Pick<MediaDeviceInfo, "deviceId" | "label" | "groupId">;

export interface ReplacementMicrophone {
  deviceId: string;
  label: string;
}

/** Inputs the browser can capture: without permission, entries come with empty IDs. */
function usableInputs(devices: readonly AudioInput[]): AudioInput[] {
  return devices.filter((device) => device.deviceId !== "");
}

/**
 * Where the voice goes after the microphone in use is unplugged: the system default
 * (Chrome lists it as "default"), or else the first one left. None: undefined.
 */
export function replacementMicrophone(
  devices: readonly AudioInput[],
): ReplacementMicrophone | undefined {
  const inputs = usableInputs(devices);
  const choice =
    inputs.find((device) => device.deviceId === "default") ??
    inputs.find((device) => device.deviceId !== "communications");
  if (!choice) return undefined;
  return { deviceId: choice.deviceId, label: microphoneLabel(choice.label, "outro microfone") };
}

/**
 * A capture on "default" stays on the device that was the default when it started.
 * When the system default moves to another device, the capture has to restart to follow.
 */
export function defaultMovedAway(
  devices: readonly AudioInput[],
  capturingGroupId: string | undefined,
): boolean {
  const current = devices.find((device) => device.deviceId === "default");
  if (!current?.groupId || !capturingGroupId) return false;
  return current.groupId !== capturingGroupId;
}
