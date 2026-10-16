import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  microphoneOptions,
  type MicrophoneOption,
} from "@/features/room/domain/microphone-options";
import {
  DeviceBadges,
  DeviceIcon,
  selectedMicrophoneIndex,
} from "@/features/room/ui/MicrophoneDevice";

/** One row per device: type icon, name and badges. */
function DeviceOption({ option, index }: { option: MicrophoneOption; index: number }) {
  return (
    <SelectItem
      value={`microphone-${index}`}
      textValue={option.label}
      className="min-h-12 gap-3 rounded-xl px-2.5 py-2 pr-9 text-ink-muted focus:bg-accent focus:text-ink data-[state=checked]:font-semibold data-[state=checked]:text-ink [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
    >
      <DeviceIcon kind={option.kind} />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm text-ink">{option.label}</span>
        <DeviceBadges option={option} />
      </span>
    </SelectItem>
  );
}

export function MicrophoneSelect({
  devices,
  value,
  onChange,
}: {
  devices: readonly Pick<MediaDeviceInfo, "deviceId" | "label">[];
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  const options = microphoneOptions(devices);
  const selectedIndex = selectedMicrophoneIndex(options, value);
  const selected = options[selectedIndex];
  if (!selected) return null;
  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="sr-only">
        Microfone em uso
      </Label>
      <Select
        value={`microphone-${selectedIndex}`}
        onValueChange={(key) => {
          const option = options.find((_, index) => key === `microphone-${index}`);
          if (option) onChange(option.value || undefined);
        }}
      >
        <SelectTrigger
          id={id}
          className="h-12 w-full gap-3 rounded-xl bg-transparent pr-3 pl-2 text-left hover:bg-surface-2 data-[state=open]:border-brand/50"
        >
          <SelectValue className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-1 items-center gap-2.5 text-sm">
              <DeviceIcon kind={selected.kind} size="sm" />
              <span className="truncate font-medium">{selected.label}</span>
              <span className="contents max-sm:hidden">
                <DeviceBadges option={selected} />
              </span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="w-(--radix-select-trigger-width) max-w-[calc(100vw-2rem)] rounded-2xl border border-line-strong bg-surface p-1 shadow-soft motion-reduce:animate-none [&_[data-slot=select-viewport]]:max-h-[min(30rem,var(--radix-select-content-available-height))] [&_[data-slot=select-viewport]]:w-full [&_[data-slot=select-viewport]]:min-w-0"
        >
          {options.map((option, index) => (
            <DeviceOption key={option.value || "default"} option={option} index={index} />
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
