import { useEffect, useState } from "react";
import { logBrowserWarning } from "@/lib/telemetry.client";

/** "default" and "communications" are aliases of a real device: the list shows the devices. */
function realDevices(devices: MediaDeviceInfo[], kind: MediaDeviceKind): MediaDeviceInfo[] {
  return devices.filter(
    (device) =>
      device.kind === kind &&
      device.deviceId !== "" &&
      device.deviceId !== "default" &&
      device.deviceId !== "communications",
  );
}

/**
 * Devices of one kind, kept current as they are plugged in or out. Names only show once
 * the browser allowed the microphone or the camera on this site.
 */
export function useMediaDevices(kind: MediaDeviceKind, refreshKey = 0): MediaDeviceInfo[] {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;
    let disposed = false;
    const load = async () => {
      try {
        const all = await media.enumerateDevices();
        if (!disposed) setDevices(realDevices(all, kind));
      } catch (error) {
        logBrowserWarning("Could not list media devices", error);
      }
    };
    const reload = () => void load();
    reload();
    media.addEventListener("devicechange", reload);
    return () => {
      disposed = true;
      media.removeEventListener("devicechange", reload);
    };
    // refreshKey re-reads the list on request, e.g. once the browser allows the device.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [kind, refreshKey]);

  return devices;
}
