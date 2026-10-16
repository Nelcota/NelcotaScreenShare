import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The pill search box: icon, a label for screen readers and the field. `label` is read
 * aloud; `placeholder` (the label by default) is what shows inside.
 */
export function SearchField({
  label,
  value,
  onChange,
  placeholder = label,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-9 min-w-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-sm focus-within:border-brand-soft",
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-subtle"
      />
    </label>
  );
}
