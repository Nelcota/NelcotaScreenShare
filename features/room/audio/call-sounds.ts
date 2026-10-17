import { currentNotificationPreferences } from "@/features/notifications/client/preferences-store";
import { logBrowserWarning } from "@/lib/telemetry.client";
import { routeToChosenOutput } from "./chosen-output";

/**
 * What happened in the call: your microphone or the room's sound on or off, you leaving,
 * someone else joining or leaving.
 */
export type CallSound =
  | "mic-on"
  | "mic-off"
  | "deafen"
  | "hear-again"
  | "leave"
  | "peer-joined"
  | "peer-left"
  | "screen-on"
  | "screen-off"
  | "watch-on"
  | "watch-off"
  | "viewer-joined"
  | "viewer-left";

/** One note: `to` glides it there (down when someone goes, up when someone comes). */
interface Note {
  frequency: number;
  to?: number;
  at: number;
  length: number;
}

const NOTE_GAP = 0.07;
const NOTE_LENGTH = 0.11;
const SOUND_VOLUME = 0.045;

function pair(first: number, second: number): readonly Note[] {
  return [
    { frequency: first, at: 0, length: NOTE_LENGTH },
    { frequency: second, at: NOTE_GAP, length: NOTE_LENGTH },
  ];
}

/** Rising when something comes on, falling when it goes off. */
const CALL_SOUND_NOTES: Record<CallSound, readonly Note[]> = {
  "mic-on": pair(660, 880),
  "mic-off": pair(880, 660),
  "hear-again": pair(440, 587),
  deafen: pair(587, 440),
  // You leave: a soft chord rolling down (G, E, C).
  leave: [
    { frequency: 784, at: 0, length: 0.22 },
    { frequency: 659, at: 0.06, length: 0.24 },
    { frequency: 523, at: 0.12, length: 0.3 },
  ],
  // Someone else: a single note, gliding up as they come and down as they go.
  "peer-joined": [{ frequency: 392, to: 523, at: 0, length: 0.22 }],
  "peer-left": [{ frequency: 523, to: 392, at: 0, length: 0.22 }],
  // A screen comes on or goes off for the room: three quick notes, up or down (C, E, G).
  "screen-on": [
    { frequency: 523, at: 0, length: NOTE_LENGTH },
    { frequency: 659, at: NOTE_GAP, length: NOTE_LENGTH },
    { frequency: 784, at: NOTE_GAP * 2, length: NOTE_LENGTH },
  ],
  "screen-off": [
    { frequency: 784, at: 0, length: NOTE_LENGTH },
    { frequency: 659, at: NOTE_GAP, length: NOTE_LENGTH },
    { frequency: 523, at: NOTE_GAP * 2, length: NOTE_LENGTH },
  ],
  // You start or stop watching a screen.
  "watch-on": pair(523, 784),
  "watch-off": pair(784, 523),
  // Someone starts or stops watching yours: a single note, like someone coming or going.
  "viewer-joined": [{ frequency: 587, to: 784, at: 0, length: 0.2 }],
  "viewer-left": [{ frequency: 784, to: 587, at: 0, length: 0.2 }],
};

/** Many people coming or going at once make one sound, not a burst. */
const PEER_SOUND_EVERY_MS = 2000;

/** Sounds that come from other people, grouped so a burst plays once. */
type GroupedSound =
  | "peer-joined"
  | "peer-left"
  | "screen-on"
  | "screen-off"
  | "viewer-joined"
  | "viewer-left";

const SOUND_GROUP: Record<GroupedSound, "peer" | "screen" | "viewer"> = {
  "peer-joined": "peer",
  "peer-left": "peer",
  "screen-on": "screen",
  "screen-off": "screen",
  "viewer-joined": "viewer",
  "viewer-left": "viewer",
};

const lastGroupSoundAt = new Map<string, number>();

let audio: AudioContext | undefined;

/** Original synthesized notes (sine with a soft attack): no recordings or third-party samples. */
function scheduleNote(context: AudioContext, note: Note, startAt: number) {
  const start = startAt + note.at;
  const end = start + note.length;
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(note.frequency, start);
  if (note.to !== undefined) oscillator.frequency.exponentialRampToValueAtTime(note.to, end);
  volume.gain.setValueAtTime(0, start);
  volume.gain.linearRampToValueAtTime(SOUND_VOLUME, start + 0.01);
  volume.gain.exponentialRampToValueAtTime(0.001, end);
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
  oscillator.stop(end);
}

/**
 * Opened on the first click or key that plays a sound, which browsers require. Without a
 * gesture (someone else joined) it does not wait: a context the browser holds stays quiet.
 */
async function readyContext(gesture: boolean): Promise<AudioContext> {
  if (!audio || audio.state === "closed") {
    audio = new AudioContext();
    void routeToChosenOutput(audio);
  }
  if (audio.state !== "suspended") return audio;
  if (gesture) await audio.resume();
  if (!gesture) void audio.resume();
  return audio;
}

/**
 * A short sound only for you (never sent to the room), unless "Sons da chamada" is off in
 * /conta. Played from the click or key that did it.
 */
export async function playCallSound(sound: CallSound, gesture = true): Promise<void> {
  if (!currentNotificationPreferences().callSounds) return;
  if (typeof AudioContext === "undefined") return;
  try {
    const context = await readyContext(gesture);
    if (context.state !== "running") return;
    for (const note of CALL_SOUND_NOTES[sound]) scheduleNote(context, note, context.currentTime);
  } catch (error) {
    logBrowserWarning("Could not play the call sound", error);
  }
}

/**
 * Something other people did (joined, left, shared a screen, started watching yours): at
 * most one sound every 2 s per kind, so ten people at once (a class arriving) make a single one.
 */
export async function playPeerSound(sound: GroupedSound, now = Date.now()): Promise<void> {
  const group = SOUND_GROUP[sound];
  if (now - (lastGroupSoundAt.get(group) ?? Number.NEGATIVE_INFINITY) < PEER_SOUND_EVERY_MS) return;
  lastGroupSoundAt.set(group, now);
  await playCallSound(sound, false);
}
