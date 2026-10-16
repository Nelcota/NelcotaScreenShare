import { useIsSpeaking, useLocalParticipant } from "@livekit/components-react";
import { AudioLines, Mic, MicOff } from "lucide-react";
import { useRoomShortcut, useShortcutLabel } from "@/lib/hooks/use-shortcut-keys";
import { cn } from "@/lib/utils";
import { DockButton } from "./DockButton";
import { MicMenu, useMicrophoneMenu } from "./MicMenu";
import { useMicTest } from "./mic-test-context";
import { useMicToggle } from "./use-mic-toggle";

/** Square on the right, next to the menu arrow, so the hover fill reaches the divider. */
const MIC_SURFACE = "rounded-l-xl rounded-r-none border-0 bg-transparent sm:w-13";

type MicLook = "testing" | "off" | "speaking" | "on";

const PAIR: Record<MicLook, string> = {
  testing: "bg-warning/15 ring-warning/30",
  off: "bg-danger/10 ring-danger/25",
  speaking:
    "bg-brand/12 shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-brand)_45%,transparent)] ring-brand",
  on: "bg-control ring-transparent",
};

const CAPTION: Record<MicLook, string> = {
  testing: "text-warning",
  off: "text-danger",
  speaking: "text-ink/85",
  on: "text-ink/85",
};

function micLook(testing: boolean, enabled: boolean, speaking: boolean): MicLook {
  if (testing) return "testing";
  if (!enabled) return "off";
  return speaking ? "speaking" : "on";
}

function MicIcon({ look }: { look: MicLook }) {
  if (look === "testing") return <AudioLines className="icon-pop size-5" aria-hidden="true" />;
  if (look === "off") return <MicOff className="icon-pop size-5" aria-hidden="true" />;
  return <Mic className="icon-pop size-5" aria-hidden="true" />;
}

function MicCaption({ look }: { look: MicLook }) {
  if (look === "testing") return "Testando";
  if (look === "off") return "Mudo";
  return (
    <>
      <span className="sm:hidden">Mic</span>
      <span className="max-sm:hidden">Microfone</span>
    </>
  );
}

const LABELS: Record<MicLook, string> = {
  testing: "Parar teste do microfone",
  off: "Ligar microfone",
  speaking: "Desligar microfone",
  on: "Desligar microfone",
};

/**
 * The microphone and its menu arrow, as one pair. During the microphone test it shows
 * "Testando", and the button and its key end the test instead of opening the microphone.
 */
export function MicControl() {
  const { localParticipant } = useLocalParticipant();
  const { enabled, busy, toggle } = useMicToggle();
  const micKey = useShortcutLabel("mic");
  const menu = useMicrophoneMenu();
  const test = useMicTest();
  // Microphone sign of life: alone in the room, nobody confirms you are being heard.
  const speaking = useIsSpeaking(localParticipant) && enabled;
  const look = micLook(test.testing, enabled, speaking);
  const press = () => void (test.testing ? test.stop() : toggle());
  useRoomShortcut("mic", press, !busy);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          // Each half has matching corners; keyboard focus can extend beyond the pair.
          "flex rounded-xl ring-1 transition-[background-color,box-shadow] duration-200 ring-inset",
          PAIR[look],
        )}
      >
        <DockButton
          label={LABELS[look]}
          tone={look === "testing" ? "testing" : look === "off" ? "muted" : "default"}
          pressed={!enabled}
          shortcut={micKey}
          disabled={busy || test.busy}
          busy={busy}
          iconClassName={MIC_SURFACE}
          onClick={press}
        >
          <MicIcon look={look} />
        </DockButton>
        <MicMenu menu={menu} disabled={busy} />
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "text-xs leading-4 font-medium whitespace-nowrap sm:text-[0.8125rem] [@media(max-height:32rem)]:hidden",
          CAPTION[look],
        )}
      >
        <MicCaption look={look} />
      </span>
    </div>
  );
}
