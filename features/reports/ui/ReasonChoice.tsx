import {
  REASON_LABELS,
  REPORT_REASONS,
  type ReportReason,
} from "@/features/reports/domain/reports";
import { cn } from "@/lib/utils";

/**
 * The report reasons as the app's choice rows (like the theme choice): the radio stays for
 * the keyboard and screen readers, hidden; the row shows which one is chosen.
 */
export function ReasonChoice({
  value,
  onChange,
}: {
  value: ReportReason | null;
  onChange: (reason: ReportReason) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">Motivo</legend>
      {REPORT_REASONS.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink has-checked:bg-surface-3 has-checked:text-ink has-focus-visible:ring-3 has-focus-visible:ring-brand/60"
        >
          <input
            type="radio"
            name="motivo"
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="sr-only"
          />
          <span
            aria-hidden="true"
            className={cn(
              "grid size-4 shrink-0 place-items-center rounded-full border-2",
              value === option ? "border-brand" : "border-line-strong",
            )}
          >
            {value === option ? <span className="size-2 rounded-full bg-brand" /> : null}
          </span>
          {REASON_LABELS[option]}
        </label>
      ))}
    </fieldset>
  );
}
