import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CalendarDays,
  Download,
  Search,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "react-day-picker/locale";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/Field";
import { ChoiceSelect } from "@/components/ChoiceSelect";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateInput, parseDateInput } from "@/lib/date-input";
import { cn } from "@/lib/utils";

export function FilterSelect<T extends string>({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  /** "No filter" option; without it, the select always has a value. */
  allLabel?: string;
  onChange: (value: T | null) => void;
}) {
  const id = useId();
  return (
    <Field size="compact" label={label} id={id}>
      {() => (
        <ChoiceSelect
          id={id}
          className="h-9 w-full bg-surface-2"
          value={value ?? ""}
          options={allLabel ? [{ value: "", label: allLabel }, ...options] : options}
          onValueChange={(nextValue) => {
            const next = options.find((option) => option.value === nextValue);
            onChange(next ? next.value : null);
          }}
        />
      )}
    </Field>
  );
}

export function FilterDate({
  label,
  value,
  onChange,
  form = false,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  /** Inside a form (not a filter bar): full-height field and the form's label style. */
  form?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = parseDateInput(value);
  return (
    <Field size={form ? "default" : "compact"} label={label} id={id}>
      {() => (
        <div className="flex gap-1">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id={id}
                ref={triggerRef}
                type="button"
                variant="outline"
                className={cn(
                  "justify-start bg-surface-2 font-normal",
                  form ? "h-11 flex-1 rounded-xl" : "h-9",
                )}
                aria-label={`${label}: ${selected ? format(selected, "dd/MM/yyyy") : "selecionar data"}`}
              >
                <CalendarDays aria-hidden="true" />
                {selected ? format(selected, "dd/MM/yyyy") : "Selecionar data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0" aria-label={label}>
              <Calendar
                mode="single"
                locale={ptBR}
                selected={selected}
                defaultMonth={selected}
                onSelect={(date) => {
                  onChange(date ? formatDateInput(date) : null);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={form ? "size-11" : "size-9"}
              aria-label={`Limpar ${label}`}
              onClick={() => {
                onChange(null);
                triggerRef.current?.focus();
              }}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      )}
    </Field>
  );
}

/** Controlled field: nuqs updates the value immediately while debouncing the URL. */
export function FilterSearch({
  label,
  placeholder,
  value,
  onChange,
  type = "search",
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  /** "text": exact search (IDs), without the magnifier icon. */
  type?: "search" | "number" | "text";
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Field
      size="compact"
      label={label}
      id={id}
      className={type === "number" ? "w-32" : "min-w-48 flex-1"}
    >
      {() => (
        <div className="relative">
          {type === "search" ? (
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
          ) : null}
          <Input
            ref={inputRef}
            id={id}
            type={type}
            min={type === "number" ? 0 : undefined}
            value={value}
            placeholder={placeholder}
            className={cn("h-9", type === "search" && "pr-9 pl-8")}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
          {type === "search" && value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
              aria-label={`Limpar ${label}`}
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      )}
    </Field>
  );
}

/** Toggles ascending/descending for the chosen sort. */
export function SortDirection({
  value,
  onChange,
}: {
  value: "asc" | "desc";
  onChange: (value: "asc" | "desc") => void;
}) {
  const descending = value === "desc";
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-9"
      aria-label={
        descending
          ? "Ordem decrescente: mudar para crescente"
          : "Ordem crescente: mudar para decrescente"
      }
      onClick={() => onChange(descending ? "asc" : "desc")}
    >
      {descending ? (
        <ArrowDownWideNarrow aria-hidden="true" />
      ) : (
        <ArrowUpNarrowWide aria-hidden="true" />
      )}
    </Button>
  );
}

/** "Limpar" (with an active filter) and "Exportar CSV" (with permission), at the end of the filter bar. */
export function FilterActions({
  active,
  onClear,
  exportHref,
}: {
  active: boolean;
  onClear: () => void;
  exportHref: string | null;
}) {
  return (
    <span className="flex gap-2">
      {active ? (
        <Button variant="ghost" size="sm" className="h-9" onClick={onClear}>
          <X aria-hidden="true" />
          Limpar
        </Button>
      ) : null}
      {exportHref ? (
        <Button asChild variant="outline" size="sm" className="h-9">
          <a href={exportHref} download>
            <Download aria-hidden="true" />
            Exportar CSV
          </a>
        </Button>
      ) : null}
    </span>
  );
}
