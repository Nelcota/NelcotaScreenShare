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
import { canShare, isMobileShare, type ShareSupport } from "@/features/room/domain/share-support";
import { UnreadCount } from "@/components/UnreadCount";

interface ControlDockProps {
  chat: ChatState;
  share: ScreenShareControl;
  /** Someone else's screen you are watching, on the stage. */
  watchedScreen?: string;
  onLeave: () => void;
}

/**
 * A phone keeps its camera and the share button: it shares where the browser allows it,
 * and elsewhere a tap says why not. A narrow computer window leaves the camera out. Below
 * 360px a phone drops one of the two so the dock fits: the camera where it can share, the
 * explanation where it cannot (the pre-join already says it).
 */
function CameraAndShare({
  share,
  support,
}: {
  share: ScreenShareControl;
  support: ShareSupport | null;
}) {
  const onPhone = support !== null && isMobileShare(support);
  const phoneShares = support !== null && onPhone && canShare(support);
  return (
    <>
      <div className={cn(!onPhone && "max-sm:hidden", phoneShares && "max-[359px]:hidden")}>
        <CameraButton />
      </div>
      <div className={cn(onPhone && !phoneShares && "max-[359px]:hidden")}>
        <ShareMenu share={share} />
      </div>
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
  const support = useShareSupport();
  const onPhone = support !== null && isMobileShare(support);

  return (
    <div
      ref={dockRef}
      className={cn(
        "@container pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]",
        // Clears the browser's "sharing your screen" bar (about 2.5rem tall).
        "group-data-capture-bar/room:pb-14",
        // Fullscreen screen: the dock comes over it while the mouse moves, then fades away. It
        // stays above the screen while it fades; once hidden, nothing on it can be clicked.
        fullscreen.isFullscreen && "z-46 transition-[opacity,visibility] duration-200",
        fullscreen.isFullscreen && !fullscreen.shown && "invisible opacity-0",
      )}
    >
      {watchedScreen ? <StopWatchingPill trackSid={watchedScreen} /> : null}
      {/* Its own box: the entrance animation moves the nav, this one keeps it centered. */}
      <div className="dock-window-center">
        <nav
          data-anim="dock"
          aria-label="Controles da chamada"
          // A phone carries one button more (camera and share), so it goes compact up to 419px.
          data-phone={onPhone || undefined}
          className="glass pointer-events-auto flex items-start gap-0.5 rounded-3xl border-line-strong bg-surface/90 p-2 data-phone:max-[419px]:gap-0 data-phone:max-[419px]:p-1 max-[360px]:gap-0 max-[360px]:p-1 sm:gap-2 sm:p-3 data-phone:max-[419px]:[&_[data-dock-surface]]:size-9 max-[360px]:[&_[data-dock-surface]]:size-9 data-phone:max-[419px]:[&_button[data-anim=dock-item]]:min-w-0 max-[360px]:[&_button[data-anim=dock-item]]:min-w-0 data-phone:max-[374px]:[&_fieldset]:gap-0.5"
        >
          <fieldset
            aria-label="Áudio e compartilhamento"
            className="flex items-start gap-1 sm:gap-2"
          >
            <MicControl />

            <DeafenButton />
            <CameraAndShare share={share} support={support} />
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
    </div>
  );
}
