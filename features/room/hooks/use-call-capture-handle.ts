import { useEffect } from "react";
import { CALL_CAPTURE_HANDLE } from "@/features/room/domain/share-support";
import { logBrowserWarning } from "@/lib/telemetry.client";

interface CaptureHandleConfig {
  handle?: string;
  exposeOrigin?: boolean;
  permittedOrigins?: string[];
}

type MediaDevicesWithCaptureHandle = MediaDevices & {
  setCaptureHandleConfig?: (config: CaptureHandleConfig) => void;
};

function setCaptureHandle(config: CaptureHandleConfig) {
  const devices: MediaDevicesWithCaptureHandle | undefined = navigator.mediaDevices;
  if (!devices?.setCaptureHandleConfig) return;
  try {
    devices.setCaptureHandleConfig(config);
  } catch (error) {
    logBrowserWarning("Could not set the call's capture handle", error);
  }
}

/**
 * While in a call, this tab tells a Nelcota page that captures it that it plays a room:
 * sharing it with sound would send that room's voices along. Only our origin sees it.
 */
export function useCallCaptureHandle() {
  useEffect(() => {
    setCaptureHandle({
      handle: CALL_CAPTURE_HANDLE,
      exposeOrigin: false,
      permittedOrigins: [location.origin],
    });
    return () => setCaptureHandle({ handle: "", permittedOrigins: [] });
  }, []);
}
