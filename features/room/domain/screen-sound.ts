/**
 * The sound of the screen being shared, as its sharer sees it: none was captured (the
 * picker's audio option unchecked, a browser without it), it is on, or the sharer turned it off.
 */
export type OwnScreenSound = "absent" | "on" | "off";

export function ownScreenSound(audio: { isMuted: boolean } | undefined): OwnScreenSound {
  if (audio === undefined) return "absent";
  return audio.isMuted ? "off" : "on";
}

/** The button's hint and the name read aloud, by state. */
export const OWN_SCREEN_SOUND_LABEL: Record<OwnScreenSound, string> = {
  absent: "Esta tela vai sem som",
  on: "Desligar o som da tela",
  off: "Ligar o som da tela",
};

/** Turning the sound back on needs a new share when none was captured. */
export const ABSENT_SOUND_NOTICE =
  "Para levar o som, compartilhe de novo e marque a opção de áudio no seletor do navegador.";
