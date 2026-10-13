import { ConfirmDialog } from "@/components/ConfirmDialog";
import { roomSwitchMessage } from "@/features/room/domain/room-switch";
import type { PendingRoomSwitch } from "@/features/room/hooks/use-room-switch-guard";
import { useStreamerMode } from "@/features/room/hooks/use-streamer-mode";

/** Asks before a navigation to another room drops the current call. */
export function RoomSwitchDialog({ pending }: { pending: PendingRoomSwitch | undefined }) {
  const { enabled: streamerMode } = useStreamerMode();
  if (pending === undefined) return null;

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) pending.cancel();
      }}
      title="Trocar de sala?"
      description={roomSwitchMessage(pending.from, pending.to, { hideCodes: streamerMode })}
      confirmLabel="Trocar de sala"
      cancelLabel="Ficar"
      onConfirm={pending.confirm}
    />
  );
}
