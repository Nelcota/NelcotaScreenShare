import type { ReactNode } from "react";

/** Panel title, aligned with the options' text. */
export function DockPopoverTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-2.5">
      <p className="text-sm font-medium tracking-tight">{children}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}
