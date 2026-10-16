import type { getWaitlist } from "@/features/admin/waitlist/server/queries.server";
import { formatDateTime } from "@/lib/format";

type WaitlistEntry = Awaited<ReturnType<typeof getWaitlist>>["latest"][number];

/** E-mail and sign-up date; short enough to fit a phone without scrolling sideways. */
export function WaitlistTable({ rows }: { rows: WaitlistEntry[] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">Ninguém na lista ainda.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line text-sm">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        >
          <span className="min-w-0 break-all">{row.email}</span>
          <span className="shrink-0 text-ink-muted">{formatDateTime(row.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
