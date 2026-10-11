import { RoomAudioRenderer, useLocalParticipant } from "@livekit/components-react";
import { Headphones, HeadphoneOff } from "lucide-react";
import { createContext, use, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { roomMicErrorMessage } from "@/features/room/client/microphone-errors";
import { MIC_ERROR_TOAST } from "@/features/room/client/toast-ids";
import { DockButton } from "./DockButton";

interface DeafenState {
  deafened: boolean;
  toggle: () => Promise<void>;
  /** Turning the microphone back on also brings the sound back, as in other call apps. */
  hearAgain: () => void;
}

const DeafenContext = createContext<DeafenState | null>(null);

/**
 * Plays the room's audio (voices and shared computer sound) unless the person deafened
 * themselves. Deafening also turns the microphone off, so nobody talks to someone who
 * cannot hear; undeafening turns it back on only if it was on before.
 */
export function DeafenProvider({ children }: { children: ReactNode }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [deafened, setDeafened] = useState(false);
  const micWasOn = useRef(false);

  async function setMic(enabled: boolean) {
    try {
      await localParticipant.setMicrophoneEnabled(enabled);
      return true;
    } catch (error) {
      toast.error(roomMicErrorMessage(error), { id: MIC_ERROR_TOAST });
      return false;
    }
  }

  async function toggle() {
    if (deafened) {
      setDeafened(false);
      if (micWasOn.current) await setMic(true);
      return;
    }
    micWasOn.current = isMicrophoneEnabled;
    if (isMicrophoneEnabled && !(await setMic(false))) {
      micWasOn.current = false;
      setDeafened(false);
      return;
    }
    setDeafened(true);
  }

  const state: DeafenState = { deafened, toggle, hearAgain: () => setDeafened(false) };
  return (
    <DeafenContext value={state}>
      {children}
      <RoomAudioRenderer muted={deafened} volume={deafened ? 0 : 1} />
    </DeafenContext>
  );
}

export function useDeafen(): DeafenState {
  const state = use(DeafenContext);
  if (state === null) throw new Error("useDeafen must be used inside DeafenProvider");
  return state;
}

/** Headphones in the dock: stop hearing the room (and stop talking) in one tap. */
export function DeafenButton() {
  const { deafened, toggle } = useDeafen();
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    setBusy(true);
    await toggle();
    setBusy(false);
  }

  return (
    <DockButton
      label={deafened ? "Voltar a ouvir a sala" : "Parar de ouvir a sala"}
      tone={deafened ? "muted" : "default"}
      caption={deafened ? "Surdo" : "Áudio"}
      pressed={deafened}
      disabled={busy}
      onClick={() => void handleToggle()}
    >
      {deafened ? (
        <HeadphoneOff className="icon-pop size-5" aria-hidden="true" />
      ) : (
        <Headphones className="icon-pop size-5" aria-hidden="true" />
      )}
    </DockButton>
  );
}
