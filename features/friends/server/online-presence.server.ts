/**
 * Who has the site open, for the Online and Offline marks. Each open tab sends a beat every
 * 45 seconds (slower in a background tab), so someone counts as online for 2 minutes after
 * the last one. Kept in memory, like the rate limits: enough for a single instance.
 */
export const ONLINE_WINDOW_MS = 2 * 60_000;

/** How often expired beats are cleared and announced as Offline. */
const SWEEP_MS = 30_000;

type OfflineListener = (userIds: string[]) => void;

const lastBeats = new Map<string, number>();

let offlineListener: OfflineListener = () => {};

let sweep: ReturnType<typeof setInterval> | null = null;

/** Who gets told when people go offline; the presence route sets it once. */
export function onWentOffline(listener: OfflineListener): void {
  offlineListener = listener;
}

export function sweepExpired(now: () => number = Date.now): string[] {
  const cutoff = now() - ONLINE_WINDOW_MS;
  const gone: string[] = [];
  for (const [userId, beat] of lastBeats) {
    if (beat >= cutoff) continue;
    lastBeats.delete(userId);
    gone.push(userId);
  }
  if (gone.length > 0) offlineListener(gone);
  return gone;
}

function startSweep(now: () => number) {
  if (sweep) return;
  sweep = setInterval(() => sweepExpired(now), SWEEP_MS);
  sweep.unref?.();
}

/** Records a beat; true when the person was offline until now. */
export function markOnline(userId: string, now: () => number = Date.now): boolean {
  startSweep(now);
  const cameOnline = !isOnline(userId, now);
  lastBeats.set(userId, now());
  return cameOnline;
}

export function isOnline(userId: string, now: () => number = Date.now): boolean {
  const beat = lastBeats.get(userId);
  if (beat === undefined) return false;
  return beat >= now() - ONLINE_WINDOW_MS;
}
