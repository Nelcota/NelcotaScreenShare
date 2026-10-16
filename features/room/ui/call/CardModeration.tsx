import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { useLocalParticipant, useParticipantAttribute } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { useId, useState } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { removeFromCall } from "@/features/room/client/api";
import { canModerate } from "@/features/room/domain/moderation";
import { parseRoomRole, ROLE_ATTRIBUTE } from "@/features/room/domain/room-role";
import { CardMenuItem } from "./CardMenuItem";
import { useRoomHost } from "./RoomHostProvider";

/** Whether I may remove this person: the owner removes anyone, a moderator participants. */
function useMayRemove(participant: Participant): boolean {
  const host = useRoomHost();
  const { localParticipant } = useLocalParticipant();
  const myRole = parseRoomRole(
    useParticipantAttribute(ROLE_ATTRIBUTE, { participant: localParticipant }),
  );
  const theirRole = parseRoomRole(useParticipantAttribute(ROLE_ATTRIBUTE, { participant }));
  if (myRole === "moderator" && host.sessionId) {
    if (!host.state || participant.identity === host.state.hostIdentity) return false;
  }
  return !participant.isLocal && canModerate(myRole, theirRole);
}

/**
 * "Expulsar da sala" on someone's card, for the owner and moderators. It asks first, since
 * the person drops out of the call at once; banning also keeps them out until it ends.
 */
export function CardModeration({
  participant,
  roomCode,
  onRemoved,
}: {
  participant: Participant;
  roomCode: string;
  onRemoved: () => void;
}) {
  const mayRemove = useMayRemove(participant);
  const [confirming, setConfirming] = useState(false);
  const [ban, setBan] = useState(false);
  const [busy, setBusy] = useState(false);
  const banId = useId();
  if (!mayRemove) return null;
  const name = participant.name || participant.identity;

  async function remove() {
    setBusy(true);
    const result = await removeFromCall(roomCode, participant.identity, ban ? "ban" : "kick");
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    const guestBan = ban && isGuestIdentity(participant.identity);
    toast.success(
      guestBan
        ? `${name} saiu da sala. Novos convidados agora pedem para entrar.`
        : `${name} saiu da sala.`,
    );
    onRemoved();
  }

  if (!confirming) {
    return (
      <CardMenuItem icon={<UserX />} danger onClick={() => setConfirming(true)}>
        Expulsar
      </CardMenuItem>
    );
  }
  return (
    <div role="alertdialog" aria-label={`Expulsar ${name}?`} className="px-1 pt-1">
      <p className="text-base font-medium">Expulsar {name}?</p>
      <p className="mt-1 text-sm text-ink-muted">A pessoa sai da chamada agora.</p>
      <label htmlFor={banId} className="mt-3 flex items-center gap-2 text-sm">
        <Checkbox id={banId} checked={ban} onCheckedChange={(value) => setBan(value === true)} />
        Não deixar voltar nesta chamada
      </label>
      {ban && isGuestIdentity(participant.identity) ? (
        <p className="mt-2 text-sm text-ink-muted">
          Depois disso, novos convidados pedem para entrar nesta chamada.
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={busy}
          className="bg-danger text-canvas hover:bg-danger/90"
          onClick={() => void remove()}
        >
          Expulsar
        </Button>
      </div>
    </div>
  );
}
