import { useMediaDeviceSelect, useRoomContext } from "@livekit/components-react";
import { Check, ChevronUp, AudioLines } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { saveMicrophone } from "@/features/room/client/saved-microphone";
import {
  hasMicrophoneChoice,
  type MicrophoneOption,
  roomMicrophoneOptions,
} from "@/features/room/domain/microphone-options";
import {
  DeviceBadges,
  DeviceIcon,
  selectedMicrophoneIndex,
} from "@/features/room/ui/MicrophoneDevice";
import { cn } from "@/lib/utils";
import { DockButton } from "./DockButton";
import { DockPopoverContent, DockPopoverTitle } from "./DockPopover";
import { Button } from "@/components/ui/button";
import { ProcessingSwitches } from "@/features/room/ui/settings/ProcessingSwitches";
import { MicTestPanel } from "./MicTest";
import { useMicTest } from "./mic-test-context";
import { logBrowserWarning } from "@/lib/telemetry.client";

export interface MicrophoneMenuState {
  options: MicrophoneOption[];
  activeDeviceId: string;
  setActiveMediaDevice: (deviceId: string) => Promise<void>;
  /** Whether the picker is shown: the microphone button squares its right side for it. */
  hasChoice: boolean;
}

/**
 * Device list for the room's microphone picker. The dock reads it so the
 * microphone button knows whether the picker sits next to it.
 */
export function useMicrophoneMenu(): MicrophoneMenuState {
  const room = useRoomContext();
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind: "audioinput",
    room,
  });
  const options = roomMicrophoneOptions(devices);
  return {
    options,
    activeDeviceId,
    setActiveMediaDevice,
    hasChoice: hasMicrophoneChoice(options),
  };
}

interface MicMenuProps {
  menu: MicrophoneMenuState;
  disabled?: boolean;
}

/**
 * Microphone choice inside the room, with the same list as the pre-join screen (one
 * item per device, default badges). Only appears with more than one device.
 */
export function MicMenu({ menu, disabled = false }: MicMenuProps) {
  const [open, setOpen] = useState(false);
  const { options, activeDeviceId, setActiveMediaDevice } = menu;

  const test = useMicTest();
  const selectedIndex = selectedMicrophoneIndex(options, activeDeviceId);

  async function choose(value: string) {
    setOpen(false);
    try {
      // "" follows the system default: in LiveKit it is the "default" device.
      await setActiveMediaDevice(value || "default");
      saveMicrophone(value || undefined);
    } catch (error) {
      logBrowserWarning("Could not switch the microphone", error);
      toast.error("Não foi possível trocar o microfone. Confira se ele está conectado.");
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <DockButton
          label="Opções do microfone"
          pressed={open}
          disabled={disabled}
          tone={open ? "active" : "default"}
          iconClassName="w-7 rounded-l-none rounded-r-xl border-0 border-l border-line-strong sm:w-8"
        >
          <ChevronUp
            className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
            aria-hidden="true"
          />
        </DockButton>
      </Popover.Trigger>
      <DockPopoverContent
        align="start"
        aria-label="Microfone"
        className="w-[min(22rem,calc(100vw-2rem))]"
      >
        {test.testing ? (
          <MicTestPanel />
        ) : (
          <>
            {menu.hasChoice ? (
              <>
                <DockPopoverTitle>Microfone</DockPopoverTitle>
                <DeviceList options={options} selectedIndex={selectedIndex} onChoose={choose} />
                <hr className="my-2 border-line" />
              </>
            ) : null}
            <DockPopoverTitle>Limpeza do microfone</DockPopoverTitle>
            <ProcessingSwitches className="px-2.5 py-1" />
            <hr className="my-2 border-line" />
            <Button
              type="button"
              variant="secondary"
              disabled={test.busy}
              onClick={() => void test.start()}
              className="w-full"
            >
              <AudioLines aria-hidden="true" />
              Testar microfone
            </Button>
          </>
        )}
      </DockPopoverContent>
    </Popover.Root>
  );
}

/** One item per device, the default badges, and a check on the one in use. */
function DeviceList({
  options,
  selectedIndex,
  onChoose,
}: {
  options: MicrophoneOption[];
  selectedIndex: number;
  onChoose: (value: string) => Promise<void>;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {options.map((option, index) => {
        const active = index === selectedIndex;
        return (
          <li key={option.value || "default"}>
            <button
              type="button"
              autoFocus={active}
              aria-current={active || undefined}
              onClick={() => void onChoose(option.value)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none active:bg-surface-3/70"
            >
              <DeviceIcon kind={option.kind} />
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className={cn("truncate", active ? "font-semibold" : "text-ink")}>
                  {option.label}
                </span>
                <DeviceBadges option={option} />
              </span>
              <Check
                className={cn("size-4 shrink-0 text-brand-soft", !active && "invisible")}
                aria-hidden="true"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
