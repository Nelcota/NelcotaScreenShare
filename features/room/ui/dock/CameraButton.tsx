import { useLocalParticipant } from "@livekit/components-react";
import { Video, VideoOff } from "lucide-react";
import { useState } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { useRoomShortcut, useShortcutLabel } from "@/lib/hooks/use-shortcut-keys";
import { logBrowserWarning } from "@/lib/telemetry.client";
import { DockButton } from "./DockButton";

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "O navegador bloqueou a câmera. Libere nas permissões do site e tente de novo.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "Nenhuma câmera encontrada.";
  }
  if (error instanceof DOMException && error.name === "NotReadableError") {
    return "A câmera está em uso por outro programa.";
  }
  return "Não foi possível ligar a câmera. Tente de novo.";
}

/** The camera starts off on every join; V turns it on and off. */
export function CameraButton() {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (error) {
      logBrowserWarning("Could not switch the camera", error);
      toast.error(cameraErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  useRoomShortcut("camera", () => void toggle(), !busy);
  const cameraKey = useShortcutLabel("camera");

  return (
    <DockButton
      label={isCameraEnabled ? "Desligar câmera" : "Ligar câmera"}
      tone={isCameraEnabled ? "active" : "default"}
      pressed={isCameraEnabled}
      shortcut={cameraKey}
      caption="Câmera"
      disabled={busy}
      busy={busy}
      onClick={() => void toggle()}
    >
      {isCameraEnabled ? (
        <Video className="icon-pop size-5" aria-hidden="true" />
      ) : (
        <VideoOff className="icon-pop size-5" aria-hidden="true" />
      )}
    </DockButton>
  );
}
