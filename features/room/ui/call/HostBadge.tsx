import { Crown } from "lucide-react";
import { useRoomHost } from "./RoomHostProvider";

export function HostBadge({ identity }: { identity: string }) {
  const { state } = useRoomHost();
  if (state?.hostIdentity !== identity) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-brand-soft">
      <Crown className="size-3.5" aria-hidden="true" />
      <span>Anfitrião</span>
    </span>
  );
}
