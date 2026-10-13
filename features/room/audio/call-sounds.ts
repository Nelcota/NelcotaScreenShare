import { currentNotificationPreferences } from "@/features/notifications/client/preferences-store";
import { logBrowserWarning } from "@/lib/telemetry.client";
import { routeToChosenOutput } from "./chosen-output";

/** What you just did in the call: the microphone on or off, the room's sound off or back. */
export type CallSound = "mic-on" | "mic-off" | "deafen" | "hear-again";

/** Two short notes: rising when something comes on, falling when it goes off. */
const CALL_SOUND_NOTES: Record<CallSound, readonly [number, number]> = {
  "mic-on": [660, 880],
  "mic-off": [880, 660],
  "hear-again": [440, 587],
  deafen: [587, 440],
};
const NOTE_GAP = 0.07;
const NOTE_LENGTH = 0.11;
const SOUND_VOLUME = 0.045;

let audio: AudioContext | undefined;

/** Original synthesized notes (sine with a soft attack): no recordings or third-party samples. */
function scheduleNote(context: AudioContext, frequency: number, start: number) {
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0, start);
  volume.gain.linearRampToValueAtTime(SOUND_VOLUME, start + 0.01);
  volume.gain.exponentialRampToValueAtTime(0.001, start + NOTE_LENGTH);
  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.addEventListener(
    "ended",
    () => {
      oscillator.disconnect();
      volume.disconnect();
    },
    { once: true },
  );
  oscillator.start(start);
  oscillator.stop(start + NOTE_LENGTH);
}

/** Opened on the first click or key that plays a sound, which browsers require. */
async function readyContext(): Promise<AudioContext> {
  if (!audio || audio.state === "closed") {
    audio = new AudioContext();
    void routeToChosenOutput(audio);
  }
  if (audio.state === "suspended") await audio.resume();
  return audio;
}

/**
 * A short sound only for you (never sent to the room), unless "Sons da chamada" is off in
 * /conta. Played from the click or key that did it.
 */
export async function playCallSound(sound: CallSound): Promise<void> {
  if (!currentNotificationPreferences().callSounds) return;
  if (typeof AudioContext === "undefined") return;
  try {
    const context = await readyContext();
    if (context.state !== "running") return;
    const [first, second] = CALL_SOUND_NOTES[sound];
    scheduleNote(context, first, context.currentTime);
    scheduleNote(context, second, context.currentTime + NOTE_GAP);
  } catch (error) {
    logBrowserWarning("Could not play the call sound", error);
  }
}
