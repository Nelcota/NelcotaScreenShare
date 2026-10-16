/** A synthesized note: frequency (Hz), start and length (s) after the sound begins. */
export interface Note {
  frequency: number;
  at: number;
  length: number;
}

export type CallEnd = "missed" | "declined";

/** The ring's loudness; the end sounds stay well below it. */
export const RING_VOLUME = 0.07;

/** Short and quiet: "Ninguém atendeu" falls in two notes; Recusar is a single click. */
export const CALL_END_SOUNDS: Record<CallEnd, { volume: number; notes: readonly Note[] }> = {
  missed: {
    volume: 0.045,
    notes: [
      { frequency: 659, at: 0, length: 0.16 },
      { frequency: 523, at: 0.15, length: 0.24 },
    ],
  },
  declined: {
    volume: 0.035,
    notes: [{ frequency: 1175, at: 0, length: 0.05 }],
  },
};

/** How long a sound lasts, in seconds. */
export function soundLength(notes: readonly Note[]): number {
  return Math.max(0, ...notes.map((note) => note.at + note.length));
}
