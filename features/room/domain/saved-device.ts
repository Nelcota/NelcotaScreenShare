/**
 * A device chosen in this browser: its id and the name the browser showed. Some browsers
 * (Brave) give devices a new id in each session, so the name finds it again.
 */
export interface SavedDevice {
  id: string;
  label: string;
}

const MAX_ID_LENGTH = 256;
const MAX_LABEL_LENGTH = 256;

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

/** Reads a saved device; a bare id, as saved before, still counts (without a name). */
export function parseSavedDevice(raw: string | null): SavedDevice | undefined {
  if (!raw || raw.length > MAX_ID_LENGTH + MAX_LABEL_LENGTH + 32) return undefined;
  if (!raw.startsWith("{")) return isText(raw, MAX_ID_LENGTH) ? { id: raw, label: "" } : undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return undefined;
    const id: unknown = Reflect.get(value, "id");
    const label: unknown = Reflect.get(value, "label");
    if (!isText(id, MAX_ID_LENGTH)) return undefined;
    return { id, label: typeof label === "string" ? label.slice(0, MAX_LABEL_LENGTH) : "" };
  } catch {
    return undefined;
  }
}

export function serializeSavedDevice(device: SavedDevice): string {
  return JSON.stringify({ id: device.id, label: device.label.slice(0, MAX_LABEL_LENGTH) });
}

interface ListedDevice {
  deviceId: string;
  label: string;
}

/**
 * The id to use now for a saved device: the same id when it is still listed, else the one
 * with the same name; `undefined` (the system default) when it is gone.
 */
export function resolveSavedDevice(
  saved: SavedDevice | undefined,
  devices: readonly ListedDevice[],
): string | undefined {
  if (!saved) return undefined;
  if (devices.some((device) => device.deviceId === saved.id)) return saved.id;
  if (!saved.label) return undefined;
  return devices.find((device) => device.label === saved.label)?.deviceId;
}
