import { useId, type ReactElement, type ReactNode } from "react";
import { Slot } from "radix-ui";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** What the field hands its control: the label's target and the hint to read with it. */
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
}

type FieldSize = "default" | "compact";

const GAPS: Record<FieldSize, string> = { default: "gap-2", compact: "gap-1.5" };
const LABELS: Record<FieldSize, string | undefined> = {
  default: undefined,
  compact: "text-xs text-ink-subtle",
};

/**
 * A label, its control and an optional hint, wired together: the control gets the label's
 * `id` and, with `hint`, an `aria-describedby` to it. A single element as `children` receives
 * them as props (its own `aria-describedby` wins); a function receives them to place itself,
 * for controls wrapped in other markup. `footer` goes under the hint (a suggestion, a guide).
 */
export function Field({
  label,
  id,
  hint,
  footer,
  size = "default",
  className,
  children,
}: {
  label: ReactNode;
  id?: string;
  hint?: ReactNode;
  footer?: ReactNode;
  size?: FieldSize;
  className?: string;
  children: ReactElement | ((control: FieldControlProps) => ReactNode);
}) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const control: FieldControlProps = {
    id: controlId,
    "aria-describedby": hint ? hintId : undefined,
  };
  return (
    <div className={cn("flex flex-col", GAPS[size], className)}>
      <Label htmlFor={controlId} className={LABELS[size]}>
        {label}
      </Label>
      {typeof children === "function" ? (
        children(control)
      ) : (
        <Slot.Root {...control}>{children}</Slot.Root>
      )}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {footer}
    </div>
  );
}
