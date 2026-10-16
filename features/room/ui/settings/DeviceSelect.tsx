import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SYSTEM = "padrao-do-sistema";

/** A device list with "Padrão do sistema" first; `undefined` is the system default. */
export function DeviceSelect({
  label,
  devices,
  value,
  onChange,
}: {
  label: string;
  devices: readonly MediaDeviceInfo[];
  value: string | undefined;
  onChange: (deviceId: string | undefined) => void;
}) {
  const id = useId();
  const known = devices.some((device) => device.deviceId === value);
  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select
        value={known && value ? value : SYSTEM}
        onValueChange={(next) => onChange(next === SYSTEM ? undefined : next)}
      >
        <SelectTrigger id={id} className="h-11 w-full rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
          <SelectItem value={SYSTEM}>Padrão do sistema</SelectItem>
          {devices.map((device, index) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || `${label} ${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
