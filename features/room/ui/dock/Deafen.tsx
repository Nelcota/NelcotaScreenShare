import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Headphones, HeadphoneOff } from "lucide-react";
import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { setDeafenedInRoom } from "@/features/room/client/api";
import { roomMicErrorMessage } from "@/features/room/client/microphone-errors";
import { MIC_ERROR_TOAST } from "@/features/room/client/toast-ids";
import { playCallSound } from "@/features/room/audio/call-sounds";
import { DockButton } from "./DockButton";
import { RoomAudioProvider } from "@/features/room/ui/call/RoomAudioProvider";
import { useRoomHost } from "@/features/room/ui/call/RoomHostProvider";
import { useMicTest } from "./mic-test-context";

interface DeafenState {
  deafened: boolean;
  /** `silent`: without the call sound (the microphone test turns the sound off quietly). */
  toggle: (options?: { silent?: boolean }) => Promise<void>;
  /** Turning the microphone back on also brings the sound back, as in other call apps. */
  hearAgain: () => void;
}

const DeafenContext = createContext<DeafenState | null>(null);

/** Tells the room when you stop hearing it, so your tile shows "Sem som" to everyone. */
function useShareDeafened(deafened: boolean) {
  const { roomCode } = useRoomHost();
  const room = useRoomContext();
  const shared = useRef(false);
  useEffect(() => {
    if (shared.current === deafened) return;
    shared.current = deafened;
    // Best effort: without it only the others' view lags, the sound itself is already off.
    void setDeafenedInRoom(roomCode ?? room.name, deafened);
  }, [deafened, roomCode, room, shared]);
}

/**
 * Plays the room's audio (voices and shared computer sound) unless the person deafened
 * themselves. Deafening also turns the microphone off, so nobody talks to someone who
 * cannot hear; undeafening turns it back on only if it was on before.
 */
export function DeafenProvider({ children }: { children: ReactNode }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [deafened, setDeafened] = useState(false);
  const micWasOn = useRef(false);
  const hearingRevision = useRef(0);
  useShareDeafened(deafened);

  async function setMic(enabled: boolean) {
    try {
      await localParticipant.setMicrophoneEnabled(enabled);
      return true;
    } catch (error) {
      toast.error(roomMicErrorMessage(error), { id: MIC_ERROR_TOAST });
      return false;
    }
  }

  async function toggle({ silent = false } = {}) {
    if (deafened) {
      setDeafened(false);
      if (!silent) void playCallSound("hear-again");
      if (micWasOn.current) await setMic(true);
      return;
    }
    const revision = hearingRevision.current;
    micWasOn.current = isMicrophoneEnabled;
    if (isMicrophoneEnabled && !(await setMic(false))) {
      micWasOn.current = false;
      setDeafened(false);
      return;
    }
    if (revision !== hearingRevision.current) return;
    setDeafened(true);
    if (!silent) void playCallSound("deafen");
  }

  const state: DeafenState = {
    deafened,
    toggle,
    hearAgain: () => {
      // Turning the microphone on supersedes a pending request to stop hearing.
      hearingRevision.current += 1;
      setDeafened(false);
    },
  };
  return (
    <DeafenContext value={state}>
      <RoomAudioProvider deafened={deafened}>{children}</RoomAudioProvider>
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
  const test = useMicTest();
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    setBusy(true);
    // During the microphone test the sound is off for it: the headphones end the test.
    await (test.testing ? test.stop() : toggle());
    setBusy(false);
  }

  return (
    <DockButton
      label={deafened ? "Voltar a ouvir a sala" : "Parar de ouvir a sala"}
      tone={deafened ? "muted" : "default"}
      caption={test.testing || deafened ? "Sem som" : "Áudio"}
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
