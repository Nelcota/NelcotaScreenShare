import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Empty values stay valid in the form without colliding with the option IDs. */
export function ChoiceSelect({
  id,
  name,
  value,
  defaultValue,
  options,
  onValueChange,
  className,
  disabled,
}: {
  id: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
  onValueChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [localValue, setLocalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const selected = value ?? localValue;
  const index = options.findIndex((option) => option.value === selected);
  return (
    <>
      {name ? <input type="hidden" name={name} value={selected} disabled={disabled} /> : null}
      <Select
        value={index < 0 ? "" : `option-${index}`}
        disabled={disabled}
        onValueChange={(key) => {
          const option = options.find((_, optionIndex) => key === `option-${optionIndex}`);
          if (!option) return;
          setLocalValue(option.value);
          onValueChange?.(option.value);
        }}
      >
        <SelectTrigger id={id} className={className}>
          {/* The label is given here, not left to Radix: it only knows it after hydration,
              so the server rendered an empty trigger that widened afterwards. */}
          <SelectValue placeholder="Selecione">{options[index]?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option, optionIndex) => (
              <SelectItem key={option.value} value={`option-${optionIndex}`}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}
