import { useEffect, useState } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { roomPath } from "@/features/room/domain/room-code";
import { copyText } from "@/lib/clipboard";

/** How long the "copied" confirmation stays on screen. */
const COPIED_MS = 2500;

/** Absolute room link, without the invite: it is meant to be sent to another person. */
export function roomUrl(code: string): string {
  return `${window.location.origin}${roomPath(code)}`;
}

function toastCopyFailure() {
  toast.error("Não foi possível copiar o link. Tente de novo.");
}

/** Copies the room link; `copied` stays on for a moment to confirm it. */
export function useCopyRoomLink(code: string, onFailure: () => void = toastCopyFailure) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    const copiedLink = await copyText(roomUrl(code), { context: "Could not copy the room link" });
    if (!copiedLink) {
      onFailure();
      return;
    }
    setCopied(true);
  }

  return { copied, copy };
}
