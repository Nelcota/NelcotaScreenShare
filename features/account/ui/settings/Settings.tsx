import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Settings group with an anchor (`/conta#id`): title outside the card and the rows
 * inside, separated by dividers. `danger` marks the deletion zone.
 */
export function SettingsSection({
  id,
  title,
  description,
  danger = false,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      // Anchor target (/conta#seguranca): receives focus when jumping to the section.
      tabIndex={-1}
      className="flex scroll-mt-6 flex-col gap-3 outline-none"
    >
      <div className="px-1">
        <h2
          id={headingId}
          className={cn("text-xl font-semibold tracking-[-0.02em]", danger && "text-danger")}
        >
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      <div
        className={cn(
          "divide-y overflow-hidden rounded-2xl border bg-surface",
          danger ? "divide-danger/20 border-danger/35" : "divide-line border-line",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Label and explanation on the left; the control on the right (stacks on mobile). */
export function SettingsRow({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-4 px-5 py-5 @xl:grid-cols-[15rem_minmax(0,1fr)] @xl:gap-6 @xl:px-6">
      <SettingsRowLabel title={title} description={description} />
      <div className="min-w-0 @xl:self-center">{children}</div>
    </div>
  );
}

export function SettingsRowLabel({
  title,
  description,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  id?: string;
}) {
  return (
    <div className="min-w-0">
      <h3 id={id} className="text-sm font-medium">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
      ) : null}
    </div>
  );
}

/** List that takes the full card width (e.g. sessions). */
export function SettingsBlock({ children }: { children: ReactNode }) {
  return <div className="px-5 py-3 @xl:px-6">{children}</div>;
}
