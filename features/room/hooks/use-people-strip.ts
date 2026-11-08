import { useSyncExternalStore } from "react";
import { useStoredValue } from "@/lib/hooks/use-stored-value";
import { createStoredValue } from "@/lib/stored-value";

/** From here up (Tailwind's `lg`) the people sit in a column beside the screen. */
const SIDE_COLUMN_QUERY = "(min-width: 64rem)";

type StripState = "open" | "shrunk";

const stripState = createStoredValue<StripState>({
  key: "nelcota-people-strip",
  changeEvent: "nelcota-people-strip-change",
  fallback: "open",
  parse: (raw) => (raw === "shrunk" ? "shrunk" : "open"),
  serialize: (state) => state,
  warning: "Could not access the people strip storage",
});

function subscribeToWidth(onChange: () => void) {
  const media = window.matchMedia(SIDE_COLUMN_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * The people beside a shared screen: whether they sit in a column (only then it can shrink)
 * and whether it is shrunk to the photos, remembered in this browser.
 */
export function usePeopleStrip() {
  const column = useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(SIDE_COLUMN_QUERY).matches,
    () => false,
  );
  const stored = useStoredValue(stripState, "open");
  const next: StripState = stored === "shrunk" ? "open" : "shrunk";
  return { column, shrunk: column && stored === "shrunk", toggle: () => stripState.write(next) };
}
