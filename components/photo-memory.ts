/** How long a photo that did not load is not asked for again (the server caches "none" as long). */
const MISSING_MS = 60_000;

/**
 * What the page learned about photos, shared by every avatar: one that did not load is not
 * asked again for a while (the same person is drawn in lists, the rail and cards). One that
 * loaded stays trusted: a later failed request (the server restarting) does not hide it.
 */
export function createPhotoMemory(now: () => number = Date.now) {
  const missingUntil = new Map<string, number>();
  const loaded = new Set<string>();
  return {
    isMissing(source: string): boolean {
      if (loaded.has(source)) return false;
      const until = missingUntil.get(source);
      if (until === undefined) return false;
      if (until > now()) return true;
      missingUntil.delete(source);
      return false;
    },
    markMissing(source: string) {
      if (loaded.has(source)) return;
      missingUntil.set(source, now() + MISSING_MS);
    },
    markLoaded(source: string) {
      loaded.add(source);
      missingUntil.delete(source);
    },
  };
}

export const photoMemory = createPhotoMemory();
