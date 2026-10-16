import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { SHARE_SUPPORT_TEXT } from "@/features/room/domain/share-support";
import { useShareSupport } from "@/features/room/hooks/use-share-support";
import { cn } from "@/lib/utils";

const ICONS = { ok: CircleCheck, warn: TriangleAlert, info: Info } as const;
const ICON_COLORS = { ok: "text-success", warn: "text-warning", info: "text-brand-soft" } as const;

/**
 * "Will it work here?": what the viewer's browser can do
 * in the room. The server cannot know, so the line only appears after
 * hydration (without flashing wrong text).
 */
export function ShareSupportNote({
  className,
  variant = "line",
}: {
  className?: string;
  /**
   * "line": access screens and the home page. "prejoin": only what this browser changes (the
   * phone, the sound); with everything working, nothing, so the pre-join stays short.
   */
  variant?: "line" | "prejoin";
}) {
  const support = useShareSupport();
  if (!support) return null;
  const { tone, title, detail } = SHARE_SUPPORT_TEXT[support];
  const Icon = ICONS[tone];
  if (variant === "prejoin") {
    if (!detail) return null;
    return (
      <p className={cn("max-w-full text-center text-sm text-ink-muted", className)}>{detail}</p>
    );
  }
  return (
    <p className={cn("flex gap-2.5 text-sm leading-snug", className)}>
      <Icon className={cn("mt-px size-4 shrink-0", ICON_COLORS[tone])} aria-hidden="true" />
      <span>
        <span className="font-medium text-ink">{title}</span>
        {detail ? <span className="text-ink-muted"> {detail}</span> : null}
      </span>
    </p>
  );
}
