/**
 * Whether this viewer receives a track. Voices always; a shared screen and its sound only
 * after the viewer chose to watch that screen (`watched` holds screen track SIDs).
 * `fromScreen`: the track is a shared screen or its sound.
 */
export function wantsTrack(
  fromScreen: boolean,
  ownerScreenSid: string | undefined,
  watched: ReadonlySet<string>,
): boolean {
  if (!fromScreen) return true;
  return ownerScreenSid !== undefined && watched.has(ownerScreenSid);
}

/** Screens still being shared: a screen that went away is no longer watched. */
export function keepPublished(
  watched: ReadonlySet<string>,
  published: ReadonlySet<string>,
): ReadonlySet<string> {
  const kept = [...watched].filter((trackSid) => published.has(trackSid));
  if (kept.length === watched.size) return watched;
  return new Set(kept);
}
