import { useMediaDeviceSelect, useRoomContext } from "@livekit/components-react";
import { SwitchCamera } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Hint } from "@/components/Hint";
import { saveCamera } from "@/features/room/client/saved-media";
import { nextCamera } from "@/features/room/domain/camera-switch";
import { logBrowserWarning } from "@/lib/telemetry.client";

/**
 * On your own camera, with more than one camera: front and back on a phone, or the next
 * webcam on a computer. It sits on the video, so the dock keeps its width.
 */
export function SwitchCameraButton() {
  const room = useRoomContext();
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind: "videoinput",
    room,
  });
  const [busy, setBusy] = useState(false);
  const next = nextCamera(devices, activeDeviceId);
  if (next === undefined) return null;

  async function switchCamera(deviceId: string) {
    setBusy(true);
    try {
      await setActiveMediaDevice(deviceId);
      saveCamera(deviceId);
    } catch (error) {
      logBrowserWarning("Could not switch the camera", error);
      toast.error("Não foi possível trocar de câmera. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Hint text="Trocar câmera">
      <button
        type="button"
        aria-label="Trocar câmera"
        disabled={busy}
        onClick={() => void switchCamera(next)}
        className="glass absolute top-3 right-3 z-30 grid size-9 place-items-center rounded-xl text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
      >
        <SwitchCamera className="size-4" aria-hidden="true" />
      </button>
    </Hint>
  );
}
