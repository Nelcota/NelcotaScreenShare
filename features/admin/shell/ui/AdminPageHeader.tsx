import type { ReactNode } from "react";

function Heading({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="mt-1 text-ink-muted">{description}</p> : null}
    </div>
  );
}

/** The title of an admin page, the line under it and, with `action`, a button beside them. */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  if (!action) return <Heading title={title} description={description} />;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <Heading title={title} description={description} />
      {action}
    </div>
  );
}
