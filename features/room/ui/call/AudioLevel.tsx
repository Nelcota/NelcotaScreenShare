import { Slider } from "@/components/ui/slider";

/** One volume for me, with its name and percentage above the slider. */
export function AudioLevel({
  label,
  accessibleLabel,
  level,
  disabled = false,
  onChange,
}: {
  label: string;
  accessibleLabel: string;
  level: number;
  disabled?: boolean;
  onChange: (level: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className={disabled ? "text-ink-subtle" : "text-ink"}>{label}</span>
        <span className="text-ink-muted tabular-nums">{level}%</span>
      </div>
      <Slider
        value={[level]}
        min={0}
        max={100}
        step={5}
        disabled={disabled}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
        thumbProps={{ "aria-label": accessibleLabel, "aria-valuetext": `${level}%` }}
      />
    </div>
  );
}
