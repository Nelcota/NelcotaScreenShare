import { MessageSquare } from "lucide-react";
import { useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { useShortcutLabel } from "@/lib/hooks/use-shortcut-keys";
import { cn } from "@/lib/utils";
import type { ChatState } from "@/features/room/hooks/use-chat-state";
import { useFullscreenDock } from "@/features/room/hooks/use-fullscreen-dock";
import { CameraButton } from "./CameraButton";
import { DeafenButton } from "./Deafen";
import { DockButton } from "./DockButton";
import { LeaveMenu } from "./LeaveMenu";
import { MicControl } from "./MicControl";
import { ReactionsMenu } from "./Reactions";
import { ShareMenu } from "./ShareMenu";
import { StopWatchingDockButton, StopWatchingPill } from "./StopWatchingDockButton";
import type { ScreenShareControl } from "@/features/room/hooks/use-screen-share";
import { useShareSupport } from "@/features/room/hooks/use-share-support";
import { UnreadCount } from "@/components/UnreadCount";

interface ControlDockProps {
  chat: ChatState;
  share: ScreenShareControl;
  /** Someone else's screen you are watching, on the stage. */
  watchedScreen?: string;
  onLeave: () => void;
}

/**
 * Phones cannot share a screen: the camera takes that place. A narrow computer window
 * keeps sharing and leaves the camera out, so the dock fits in 320px.
 */
function CameraAndShare({ share }: { share: ScreenShareControl }) {
  const onPhone = useShareSupport() === "mobile";
  return (
    <>
      <div className={cn(!onPhone && "max-sm:hidden")}>
        <CameraButton />
      </div>
      {onPhone ? null : <ShareMenu share={share} />}
    </>
  );
}

/**
 * Controls grouped by function: audio/screen, interaction and leave.
 * The device picker is part of the microphone control, on phones too.
 */
export function ControlDock({ chat, share, watchedScreen, onLeave }: ControlDockProps) {
  const chatKey = useShortcutLabel("chat");
  const dockRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreenDock(dockRef);

  return (
    <div
      ref={dockRef}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]",
        // Clears the browser's "sharing your screen" bar (about 2.5rem tall).
        "group-data-capture-bar/room:pb-14",
        // Chat open on a wide screen: the dock centers in the remaining space, like the content.
        chat.open && "lg:pr-[26.5rem]",
        // Fullscreen screen: the dock comes over it while the mouse moves, then fades away.
        fullscreen.isFullscreen && "transition-opacity duration-200",
        fullscreen.isFullscreen && !fullscreen.shown && "opacity-0",
        fullscreen.shown && "z-46",
      )}
    >
      {watchedScreen ? <StopWatchingPill trackSid={watchedScreen} /> : null}
      <nav
        data-anim="dock"
        aria-label="Controles da chamada"
        className="glass pointer-events-auto flex items-start gap-0.5 rounded-3xl border-line-strong bg-surface/90 p-2 max-[360px]:gap-0 max-[360px]:p-1 sm:gap-2 sm:p-3 max-[360px]:[&_[data-dock-surface]]:size-9 max-[360px]:[&_button[data-anim=dock-item]]:min-w-0"
      >
        <fieldset aria-label="Áudio e compartilhamento" className="flex items-start gap-1 sm:gap-2">
          <MicControl />

          <DeafenButton />
          <CameraAndShare share={share} />
          {watchedScreen ? (
            <div className="max-sm:hidden">
              <StopWatchingDockButton trackSid={watchedScreen} />
            </div>
          ) : null}
        </fieldset>

        <Separator
          orientation="vertical"
          className="mx-0.5 mt-1.5 h-8 w-px bg-line-strong sm:mx-1 sm:mt-2 data-vertical:self-start"
        />

        <fieldset aria-label="Interação" className="flex items-start gap-1 sm:gap-2">
          <ReactionsMenu />

          <DockButton
            label={
              chat.unread > 0
                ? `Chat (${chat.unread} ${chat.unread === 1 ? "nova" : "novas"})`
                : "Chat"
            }
            tone={chat.open ? "active" : "default"}
            caption="Chat"
            pressed={chat.open}
            shortcut={chatKey}
            onClick={() => chat.setOpen(!chat.open)}
          >
            <MessageSquare className="size-5" aria-hidden="true" />
            <UnreadCount
              count={chat.unread}
              tone="brand"
              max={9}
              aria-hidden="true"
              className="-top-1.5 -right-1.5 z-auto h-5 min-w-5 text-xs font-medium"
            />
          </DockButton>
        </fieldset>

        <Separator
          orientation="vertical"
          className="mx-0.5 mt-1.5 h-8 w-px bg-line-strong sm:mx-1 sm:mt-2 data-vertical:self-start"
        />

        <LeaveMenu onLeave={onLeave} />
      </nav>
    </div>
  );
}
