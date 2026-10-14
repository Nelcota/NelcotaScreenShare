import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Notice section with an anchor: number, title and a context sentence. */
export function PrivacySection({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: number;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="flex scroll-mt-24 flex-col gap-4 outline-none"
    >
      <header className="px-1">
        <p className="text-xs font-medium text-ink-subtle tabular-nums">
          {String(index).padStart(2, "0")}
        </p>
        <h2 id={headingId} className="mt-1 text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** Card with rows separated by dividers, following the /conta pattern. */
export function PrivacyList({ children }: { children: ReactNode }) {
  return <ul className="panel divide-y divide-line overflow-hidden rounded-2xl">{children}</ul>;
}

/** Row with an icon on the left; `aside` shows a highlight on the right (e.g. a period). */
export function PrivacyItem({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: LucideIcon;
  title: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-4 px-5 py-4 sm:px-6 sm:py-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-muted">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          {children ? (
            <div className="mt-1 text-sm leading-relaxed text-ink-muted">{children}</div>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </li>
  );
}
