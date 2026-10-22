/** A screen as the stage sees it: whose it is and its track. */
interface ScreenOnCall {
  participant: { isLocal: boolean };
  publication: { trackSid: string };
}

/**
 * Someone else's screen you are watching, for "Parar de assistir": the one on the stage, or,
 * when your own screen is the one there, another person's you still receive.
 */
export function watchedRemoteScreen(
  focused: ScreenOnCall | undefined,
  watched: readonly ScreenOnCall[],
): string | undefined {
  if (focused !== undefined && !focused.participant.isLocal) return focused.publication.trackSid;
  return watched.find((screen) => !screen.participant.isLocal)?.publication.trackSid;
}
