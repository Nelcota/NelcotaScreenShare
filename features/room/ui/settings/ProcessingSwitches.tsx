import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveAudioProcessing } from "@/features/room/client/saved-media";
import type { AudioProcessing } from "@/features/room/domain/audio-processing";
import { useSavedAudioProcessing } from "@/features/room/hooks/use-saved-audio-processing";
import { cn } from "@/lib/utils";

const PROCESSING_OPTIONS: { key: keyof AudioProcessing; label: string }[] = [
  { key: "noiseSuppression", label: "Redução de ruído" },
  { key: "echoCancellation", label: "Cancelamento de eco" },
  { key: "autoGainControl", label: "Ganho automático" },
];

function ProcessingSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * The microphone clean-up switches, the same in the account and in the call's microphone
 * menu. Saving announces the change: an open call and a running test follow it.
 */
export function ProcessingSwitches({ className }: { className?: string }) {
  const processing = useSavedAudioProcessing();
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {PROCESSING_OPTIONS.map(({ key, label }) => (
        <ProcessingSwitch
          key={key}
          label={label}
          checked={processing[key]}
          onChange={(checked) => saveAudioProcessing({ ...processing, [key]: checked })}
        />
      ))}
    </div>
  );
}
