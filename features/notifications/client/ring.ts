import { logBrowserWarning } from "@/lib/telemetry.client";

/** One ring: two short rising pairs, then silence until the next one. */
const RING_NOTES = [
  { frequency: 784, at: 0, length: 0.14 },
  { frequency: 1047, at: 0.12, length: 0.18 },
  { frequency: 784, at: 0.42, length: 0.14 },
  { frequency: 1047, at: 0.54, length: 0.22 },
] as const;
const RING_EVERY_MS = 2_200;
const RING_VOLUME = 0.07;

let audio: AudioContext | undefined;

/** Original synthesized notes (sine with a soft attack): no recordings or third-party samples. */
function scheduleNote(context: AudioContext, frequency: number, start: number, length: number) {
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0, start);
  volume.gain.linearRampToValueAtTime(RING_VOLUME, start + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.001, start + length);
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
  oscillator.stop(start + length);
}

function playOneRing(context: AudioContext) {
  const start = context.currentTime;
  for (const note of RING_NOTES)
    scheduleNote(context, note.frequency, start + note.at, note.length);
}

/**
 * Browsers only start audio during a click or key press. The runtime calls this on the
 * first gesture, so a call that arrives later can ring.
 */
export async function unlockRingAudio(): Promise<void> {
  if (typeof AudioContext === "undefined") return;
  try {
    if (!audio || audio.state === "closed") audio = new AudioContext();
    if (audio.state === "suspended") await audio.resume();
  } catch (error) {
    logBrowserWarning("Could not start the ring audio", error);
  }
}

/** Rings until `stop`. Without an unlocked audio context it stays silent. */
export function startRing(): { stop: () => void } {
  const context = audio;
  if (!context || context.state !== "running") return { stop: () => {} };
  try {
    playOneRing(context);
  } catch (error) {
    logBrowserWarning("Could not play the ring", error);
    return { stop: () => {} };
  }
  const timer = window.setInterval(() => playOneRing(context), RING_EVERY_MS);
  return { stop: () => window.clearInterval(timer) };
}
