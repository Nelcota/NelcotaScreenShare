import { useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { subscribeNothing } from "@/lib/hooks/subscribe-nothing";
import {
  micErrorMessage,
  microphonePermissionDenied,
} from "@/features/room/client/microphone-errors";
import {
  saveMicrophone,
  savedMicrophone,
  savedMicrophoneLabel,
} from "@/features/room/client/saved-microphone";
import { joinsWithMicrophone, saveJoinsWithMicrophone } from "@/features/room/client/saved-media";
import { useMicLevel } from "./use-mic-level";
import { useMicPermission } from "./use-mic-permission";
import type { MicrophoneCheck } from "@/features/room/domain/microphone-check";

/**
 * Microphone in the pre-join screen: on or off, browser permission, chosen
 * device (remembered), error and the live meter. `paused`: joining the room.
 */
export function useMicSetup(paused: boolean, meterRef: RefObject<HTMLDivElement | null>) {
  // "Entrar com microfone ligado": chosen on this screen, else as last time in this browser.
  const savedOn = useSyncExternalStore(subscribeNothing, joinsWithMicrophone, () => true);
  const [switched, setSwitched] = useState<boolean>();
  const enabled = switched ?? savedOn;
  const [error, setError] = useState<string>();
  const [requesting, setRequesting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  // The list the capture just read, before the state above updates.
  const listed = useRef<MediaDeviceInfo[]>([]);
  // Found again by name once already: a browser that renames it on every read (Brave)
  // would restart the capture forever ("Conectando microfone…" in a loop).
  const foundByName = useRef(false);
  const [captured, setCaptured] = useState<{
    requestedId: string | undefined;
    deviceId: string | undefined;
  }>();
  const [check, setCheck] = useState<{ deviceId: string | undefined; state: MicrophoneCheck }>();
  const { permission, setPermission, request } = useMicPermission();
  // Choice made on this screen; before that, the microphone from last time applies.
  // `null` is "Padrão do sistema" chosen on purpose.
  const [chosen, setChosen] = useState<string | null>();
  // The saved microphone only changes through this screen, which already keeps the choice in state.
  const saved = useSyncExternalStore(subscribeNothing, savedMicrophone, () => undefined);
  const requestedId = chosen === undefined ? saved : (chosen ?? undefined);
  const deviceId = captured?.requestedId === requestedId ? captured?.deviceId : requestedId;
  // Live meter on its own: with permission granted and the microphone on, nobody
  // has to find a "Testar" button (non-technical users do not test and join muted).
  const testing = enabled && permission === "granted" && !error && !paused;
  const blocked = permission === "denied";

  const levelRef = useMicLevel(meterRef, testing, requestedId, {
    onDevices: (list) => {
      listed.current = list;
      setDevices(list);
    },
    onDevice: (id, requested) => setCaptured({ requestedId: requested, deviceId: id }),
    onMissingDevice: () => {
      // The browser may give the same microphone a new id (Brave): found again by name.
      const label = savedMicrophoneLabel();
      const again = label ? listed.current.find((device) => device.label === label) : undefined;
      // Still there under yet another id: the capture already running is that microphone.
      if (again && foundByName.current) return;
      setCheck(undefined);
      if (again) {
        foundByName.current = true;
        setChosen(again.deviceId);
        saveMicrophone(again.deviceId);
        return;
      }
      setChosen(null);
      saveMicrophone(undefined);
    },
    onPermissionDenied: () => setPermission("denied"),
    onError: (failure) => setError(micErrorMessage(failure)),
    onCheck: (state, source) => setCheck({ deviceId: source, state }),
  });

  return {
    levelRef,
    check: testing && check !== undefined && check.deviceId === deviceId ? check.state : "starting",
    enabled,
    permission,
    error,
    requesting,
    devices,
    deviceId,
    testing,
    blocked,
    /** Joins without a microphone (turned off or blocked by the browser). */
    joinsMuted: !enabled || blocked,
    setEnabled(next: boolean) {
      setSwitched(next);
      saveJoinsWithMicrophone(next);
      setError(undefined);
      setCheck(undefined);
    },
    clearError: () => {
      setError(undefined);
      setCheck(undefined);
    },
    choose(id: string | undefined) {
      setChosen(id ?? null);
      setCheck(undefined);
      saveMicrophone(id);
    },
    async askPermission() {
      setRequesting(true);
      setError(undefined);
      const failure = await request();
      setRequesting(false);
      if (failure && !microphonePermissionDenied(failure)) {
        setError(micErrorMessage(failure));
      }
    },
  };
}

export type MicSetupState = ReturnType<typeof useMicSetup>;
