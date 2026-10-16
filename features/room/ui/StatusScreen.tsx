import type { LucideIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useLocation, useViewTransitionState } from "react-router";
import { gsap, MOTION_DURATION, MOTION_QUERIES, useGSAP } from "@/lib/animation/gsap";
import { cn } from "@/lib/utils";

interface StatusScreenProps {
  icon: LucideIcon;
  tone?: "brand" | "danger";
  title: string;
  message?: string;
  alert?: boolean;
  children: ReactNode;
}

/** Centered card for the connection-failure screen. */
export function StatusScreen({
  icon: Icon,
  tone = "brand",
  title,
  message,
  alert,
  children,
}: StatusScreenProps) {
  const scope = useRef<HTMLDivElement>(null);
  const transitioning = useViewTransitionState(useLocation().pathname);

  useGSAP(
    () => {
      const screen = scope.current;
      if (transitioning || !screen) return;
      const media = gsap.matchMedia();
      media.add(MOTION_QUERIES.motion, () => {
        gsap.from(screen, {
          y: 12,
          opacity: 0,
          duration: MOTION_DURATION.entrance,
          clearProps: "transform,opacity",
        });
      });
    },
    { scope },
  );

  return (
    <div
      ref={scope}
      role={alert ? "alert" : undefined}
      className="panel w-full max-w-md rounded-2xl p-8 text-center"
    >
      <div
        className={cn(
          "mx-auto mb-5 grid size-12 place-items-center rounded-2xl",
          tone === "danger" ? "bg-danger/15" : "bg-surface-2",
        )}
      >
        <Icon
          className={cn("size-5", tone === "danger" ? "text-danger" : "text-brand-soft")}
          aria-hidden="true"
        />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {message ? <p className="mt-2 font-light text-ink-muted">{message}</p> : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row [&>*]:flex-1">{children}</div>
    </div>
  );
}
