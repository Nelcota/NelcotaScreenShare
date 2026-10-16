import {
  parseSavedDevice,
  resolveSavedDevice,
  serializeSavedDevice,
  type SavedDevice,
} from "@/features/room/domain/saved-device";
import { logBrowserWarning } from "@/lib/telemetry.client";

/** The device saved under `key` in this browser, with its name when known. */
export function readSavedDevice(key: string): SavedDevice | undefined {
  try {
    return parseSavedDevice(localStorage.getItem(key));
  } catch {
    return undefined;
  }
}

function write(key: string, device: SavedDevice | undefined) {
  try {
    if (device) {
      localStorage.setItem(key, serializeSavedDevice(device));
      return;
    }
    localStorage.removeItem(key);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

async function listed(kind: MediaDeviceKind) {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === kind && device.deviceId);
}

/**
 * Saves a device by id now and adds its name as soon as the browser lists it, so the
 * choice is found again when the id changes (Brave gives new ids in each session).
 */
export function writeSavedDevice(key: string, kind: MediaDeviceKind, id: string | undefined) {
  if (!id) {
    write(key, undefined);
    return;
  }
  write(key, {
    id,
    label: readSavedDevice(key)?.id === id ? (readSavedDevice(key)?.label ?? "") : "",
  });
  void addLabel(key, kind, id);
}

async function addLabel(key: string, kind: MediaDeviceKind, id: string) {
  try {
    const label = (await listed(kind)).find((device) => device.deviceId === id)?.label;
    if (label && readSavedDevice(key)?.id === id) write(key, { id, label });
  } catch (error) {
    logBrowserWarning("Could not read the device names", error);
  }
}

/**
 * The id to use now for the device saved under `key`: the same one, or the device with the
 * same name under a new id; `undefined` (the system default) when it is gone.
 */
export async function currentSavedDevice(
  key: string,
  kind: MediaDeviceKind,
): Promise<string | undefined> {
  const saved = readSavedDevice(key);
  if (!saved) return undefined;
  try {
    const id = resolveSavedDevice(saved, await listed(kind));
    // Found under a new id: keep that one, so later reads need no lookup.
    if (id && id !== saved.id) write(key, { id, label: saved.label });
    return id;
  } catch (error) {
    logBrowserWarning("Could not list the devices", error);
    return saved.id;
  }
}
