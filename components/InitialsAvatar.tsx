import { useState } from "react";
import { photoMemory } from "@/components/photo-memory";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

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
    source !== null && photoMemory.isMissing(source) ? source : null,
  );
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const showLoaded = (loaded: string) => {
    photoMemory.markLoaded(loaded);
    setLoadedSource(loaded);
  };
  const giveUp = (failed: string) => {
    photoMemory.markMissing(failed);
    // A photo this page already showed stays: the failure was the request, not the photo.
    if (photoMemory.isMissing(failed)) setFailedSource(failed);
  };
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
            if (element.naturalWidth > 0) return showLoaded(source);
            giveUp(source);
          }}
          data-slot="avatar-image"
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => showLoaded(source)}
          onError={() => giveUp(source)}
          className={cn(
            "absolute inset-0 size-full object-cover",
            loadedSource === source ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </span>
  );
}
