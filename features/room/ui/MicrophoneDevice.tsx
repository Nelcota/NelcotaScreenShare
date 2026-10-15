import { Bluetooth, Camera, Headphones, Mic, Phone, Star, type LucideIcon } from "lucide-react";
import type { MicrophoneOption } from "@/features/room/domain/microphone-options";
import { Hint } from "@/components/Hint";
import { cn } from "@/lib/utils";

const ICONS = { system: Mic, microphone: Mic, headset: Headphones, camera: Camera };

/** One color per device type: the headset or the webcam can be spotted at a glance. */
const KIND_COLORS = {
  system: "bg-brand/15 text-brand-soft",
  microphone: "bg-brand/15 text-brand-soft",
  headset: "bg-violet/15 text-violet",
  camera: "bg-warning/15 text-warning",
} as const;

const BADGES: Partial<Record<string, { icon: LucideIcon; className: string }>> = {
  Padrão: { icon: Star, className: "bg-brand/15 text-brand-soft" },
  Chamadas: { icon: Phone, className: "bg-info/15 text-info" },
};

/** Microphone icon colored by type, the same in the pre-join screen and the room dock. */
export function DeviceIcon({
  kind,
  size = "md",
}: {
  kind: MicrophoneOption["kind"];
  size?: "sm" | "md";
}) {
  const Icon = ICONS[kind];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-lg",
        size === "md" ? "size-8" : "size-7",
        KIND_COLORS[kind],
      )}
    >
      <Icon className={size === "md" ? "size-[18px]" : "size-4"} />
    </span>
  );
}

/** Microphone badges ("Padrão", "Chamadas", Bluetooth). */
export function DeviceBadges({ option }: { option: MicrophoneOption }) {
  return (
    <>
      {option.badges.map((badge) => {
        const style = BADGES[badge];
        const BadgeIcon = style?.icon;
        return (
          <span
            key={badge}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              style?.className ?? "bg-surface-3 text-ink-muted",
            )}
          >
            {BadgeIcon ? <BadgeIcon className="size-3.5" aria-hidden="true" /> : null}
            {badge}
          </span>
        );
      })}
      {option.detail === "Bluetooth" ? (
        <Hint text="Bluetooth">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-info/15 text-info">
            <Bluetooth className="size-4" aria-hidden="true" />
            <span className="sr-only">Bluetooth</span>
          </span>
        </Hint>
      ) : option.detail ? (
        <span className="shrink-0 text-xs text-ink-subtle">{option.detail}</span>
      ) : null}
    </>
  );
}

/** Index of the option matching the chosen ID ("" or "default" = system default). */
export function selectedMicrophoneIndex(options: MicrophoneOption[], id: string | undefined) {
  const current = id === "default" ? "" : (id ?? "");
  return Math.max(
    0,
    options.findIndex((option) => option.value === current || option.aliases.includes(current)),
  );
}
