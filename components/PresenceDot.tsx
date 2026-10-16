import { cn } from "@/lib/utils";

export type Presence = "online" | "away" | "busy" | "offline";

/** Green, yellow or red, and an empty ring when offline, as in the friends list. */
const DOT: Record<Presence, string> = {
  online: "bg-success",
  away: "bg-status-away",
  busy: "bg-danger",
  offline: "border-2 border-ink-subtle bg-surface",
};

/** The status mark on the corner of a photo. */
export function PresenceDot({ status, className }: { status: Presence; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-surface",
        DOT[status],
        className,
      )}
    />
  );
}
