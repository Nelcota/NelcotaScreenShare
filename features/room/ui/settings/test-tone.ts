type SinkAudio = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };

const TONE_SECONDS = 0.8;

/**
 * A short, soft chime on the chosen output. Only ever started by a click: nothing plays on
 * its own. Resolves when it ends.
 */
export async function playTestTone(sinkId: string | undefined): Promise<void> {
  const context = new AudioContext();
  try {
    const destination = context.createMediaStreamDestination();
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + TONE_SECONDS);
    gain.connect(destination);
    for (const [frequency, start] of [
      [660, 0],
      [880, 0.18],
    ] as const) {
      const tone = context.createOscillator();
      tone.frequency.value = frequency;
      tone.connect(gain);
      tone.start(now + start);
      tone.stop(now + TONE_SECONDS);
    }
    const audio: SinkAudio = new Audio();
    audio.srcObject = destination.stream;
    if (sinkId && audio.setSinkId) await audio.setSinkId(sinkId);
    await audio.play();
    await new Promise((resolve) => setTimeout(resolve, TONE_SECONDS * 1000 + 100));
    audio.pause();
  } finally {
    await context.close();
  }
}

/** Can the page choose where its sound plays? Chromium and Firefox can; Safari cannot. */
export function canChooseOutput(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}
