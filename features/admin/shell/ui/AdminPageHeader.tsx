import type { ReactNode } from "react";

/** The title of an admin page and the line under it. */
export function AdminPageHeader({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="mt-1 text-ink-muted">{description}</p> : null}
    </div>
  );
}
