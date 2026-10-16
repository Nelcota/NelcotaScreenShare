import type { ReactNode } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { HEALTH_LABELS, type HealthState } from "@/features/admin/status/domain/health";

/** One dependency: its name, a status badge (text + color) and one short line. */
export function HealthCard({
  title,
  state,
  children,
}: {
  title: string;
  /** Left out for cards that only inform (e.g. the deployed version). */
  state?: HealthState;
  children: ReactNode;
}) {
  return (
    <li className="panel flex h-full flex-col gap-2 rounded-2xl p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {state ? (
        <div>
          <StatusBadge tone={HEALTH_LABELS[state].tone}>{HEALTH_LABELS[state].label}</StatusBadge>
        </div>
      ) : null}
      <div className="text-sm text-ink-muted">{children}</div>
    </li>
  );
}
