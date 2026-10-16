export interface MicrophoneOption {
  /** Chosen value: "" follows the system default. */
  value: string;
  /**
   * Other IDs that point to this device: the physical one, when the value is "",
   * and "communications" on the calls device. A choice saved with one of them
   * keeps marking the device that is actually being captured.
   */
  aliases: string[];
  label: string;
  /** Short badges: "Padrão", "Chamadas". */
  badges: string[];
  /** Useful detail, only when it tells something ("Bluetooth"). */
  detail?: string;
  kind: "system" | "microphone" | "headset" | "camera";
}

type AudioDevice = Pick<MediaDeviceInfo, "deviceId" | "label">;

const WRAPPER_PREFIX = /^(?:default|padr[aã]o|communications|comunica[cç][oõ]es)\s*-\s*/i;

/** Strips only the known wrappers; the ID used for capture does not change. */
export function microphoneLabel(label: string, fallback: string): string {
  const clean = label
    .replace(WRAPPER_PREFIX, "")
    .replace(/\s+\([\da-f]{4}:[\da-f]{4}\)$/i, "")
    .trim();
  const wrapped = /^(?:microphone|microfone|headset)\s+\(([^()]+)\)(?:\s+\(Bluetooth\))?$/i.exec(
    clean,
  );
  return wrapped?.[1] ?? (clean || fallback);
}

function deviceKind(label: string): MicrophoneOption["kind"] {
  if (/webcam|smartcam|camera|câmera|\bcam\b/i.test(label)) return "camera";
  if (/headset|headphone|fone de ouvido|bluetooth/i.test(label)) return "headset";
  return "microphone";
}

/** Which real device Chrome's "default"/"communications" entry points to. */
function sameDevice(alias: AudioDevice | undefined, device: AudioDevice): boolean {
  return !!alias?.label && alias.label.replace(WRAPPER_PREFIX, "").trim() === device.label.trim();
}

/**
 * One option per device. The system default and the calls default become badges
 * on the device itself; choosing "Padrão" follows the system (value "").
 */
export function microphoneOptions(devices: readonly AudioDevice[]): MicrophoneOption[] {
  const system = devices.find((device) => device.deviceId === "default");
  const calls = devices.find((device) => device.deviceId === "communications");
  const physical = devices.filter(
    (device) => device.deviceId !== "default" && device.deviceId !== "communications",
  );
  const systemDevice = physical.find((device) => sameDevice(system, device));

  const options = physical.map((device, index): MicrophoneOption => {
    const isSystem = device === systemDevice;
    const isCalls = sameDevice(calls, device);
    const badges = [...(isSystem ? ["Padrão"] : []), ...(isCalls ? ["Chamadas"] : [])];
    return {
      value: isSystem ? "" : device.deviceId,
      aliases: [...(isSystem ? [device.deviceId] : []), ...(isCalls ? ["communications"] : [])],
      label: microphoneLabel(device.label, `Microfone ${index + 1}`),
      badges,
      ...(/bluetooth/i.test(device.label) ? { detail: "Bluetooth" } : {}),
      kind: deviceKind(device.label),
    };
  });

  if (systemDevice) {
    // The default goes first: it is the most common choice.
    const index = physical.indexOf(systemDevice);
    options.unshift(...options.splice(index, 1));
    return options;
  }
  // Without knowing which device is the default (other browsers): a separate option.
  return [
    {
      value: "",
      label: system?.label
        ? microphoneLabel(system.label, "Padrão do sistema")
        : "Padrão do sistema",
      aliases: [],
      badges: ["Padrão"],
      kind: "system",
    },
    ...options,
  ];
}

/**
 * Options offered inside the room. Without the "default" entry (Firefox, Safari),
 * the generic option would have nothing to point to, so it is left out.
 */
export function roomMicrophoneOptions(devices: readonly AudioDevice[]): MicrophoneOption[] {
  const hasDefault = devices.some((device) => device.deviceId === "default");
  return microphoneOptions(devices).filter((option) => option.kind !== "system" || hasDefault);
}

/** The room's microphone picker only appears when there is something to choose. */
export function hasMicrophoneChoice(options: readonly MicrophoneOption[]): boolean {
  return options.length >= 2;
}
