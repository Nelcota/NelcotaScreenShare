import { messageTime } from "@/features/messages/domain/timeline";
import { cn } from "@/lib/utils";

/** The time inside the bubble, at its end, like a phone chat. */
export function BubbleTime({ at, own, overlay }: { at: Date; own: boolean; overlay?: boolean }) {
  return (
    <time
      dateTime={at.toISOString()}
      className={cn(
        "text-[0.6875rem] leading-none tabular-nums",
        overlay
          ? "absolute right-2.5 bottom-2.5 rounded-full bg-black/55 px-1.5 py-1 text-white"
          : "float-right mt-2 ml-3 translate-y-0.5",
        !overlay && (own ? "text-brand-ink/70" : "text-ink-subtle"),
      )}
    >
      {messageTime(at)}
    </time>
  );
}
