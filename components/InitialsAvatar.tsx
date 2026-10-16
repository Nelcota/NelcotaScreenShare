import { useState } from "react";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

/** How long a photo that did not load is not asked for again (the server caches "none" as long). */
const MISSING_MS = 60_000;

/**
 * Photos that did not load, shared by every avatar on the page: the same person drawn again
 * (lists, rail, cards, a page reload of the data) does not ask the server again for a while.
 */
const missingUntil = new Map<string, number>();

function knownMissing(source: string): boolean {
  const until = missingUntil.get(source);
  if (until === undefined) return false;
  if (until > Date.now()) return true;
  missingUntil.delete(source);
  return false;
}

function markMissing(source: string) {
  missingUntil.set(source, Date.now() + MISSING_MS);
}

/**
 * Someone's initials, with their photo over them once it loads. Without a photo, or when it
 * fails, the initials stay. The photo stays invisible until it has loaded, so a missing one
 * never shows the browser's broken-image mark, not even before hydration.
 */
export function InitialsAvatar({
  name,
  source,
  className,
}: {
  name: string;
  source: string | null;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(() =>
    source !== null && knownMissing(source) ? source : null,
  );
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const showPhoto = source !== null && source !== failedSource;
  return (
    <span
      aria-hidden="true"
      className={cn("relative grid place-items-center overflow-hidden rounded-full", className)}
    >
      {initials(name)}
      {showPhoto ? (
        <img
          key={source}
          ref={(element) => {
            // The server-rendered photo may have settled before hydration installed the handlers.
            if (!element?.complete) return;
            if (element.naturalWidth > 0) return setLoadedSource(source);
            markMissing(source);
            setFailedSource(source);
          }}
          data-slot="avatar-image"
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoadedSource(source)}
          onError={() => {
            markMissing(source);
            setFailedSource(source);
          }}
          className={cn(
            "absolute inset-0 size-full object-cover",
            loadedSource === source ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </span>
  );
}
