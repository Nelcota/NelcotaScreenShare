import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { useLocalParticipant, useParticipantAttribute } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { removeFromCall } from "@/features/room/client/api";
import { canModerate } from "@/features/room/domain/moderation";
import { parseRoomRole, ROLE_ATTRIBUTE } from "@/features/room/domain/room-role";

/** Whether I may remove this person: the owner removes anyone, a moderator participants. */
function useMayRemove(participant: Participant): boolean {
  const { localParticipant } = useLocalParticipant();
  const myRole = parseRoomRole(
    useParticipantAttribute(ROLE_ATTRIBUTE, { participant: localParticipant }),
  );
  const theirRole = parseRoomRole(useParticipantAttribute(ROLE_ATTRIBUTE, { participant }));
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
    toast.success(`${name} saiu da sala.`);
    onRemoved();
  }

  if (!confirming) {
    return (
      <div className="border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex h-10 w-full items-center justify-center rounded-xl text-base font-medium text-danger transition-colors hover:bg-danger/10"
        >
          Expulsar da sala
        </button>
      </div>
    );
  }
  return (
    <div role="alertdialog" aria-label={`Expulsar ${name}?`} className="border-t border-line pt-3">
      <p className="text-base font-medium">Expulsar {name}?</p>
      <p className="mt-1 text-sm text-ink-muted">A pessoa sai da chamada agora.</p>
      <label htmlFor={banId} className="mt-3 flex items-center gap-2 text-sm">
        <Checkbox id={banId} checked={ban} onCheckedChange={(value) => setBan(value === true)} />
        Não deixar voltar nesta chamada
      </label>
      {ban && isGuestIdentity(participant.identity) ? (
        <p className="mt-2 text-sm text-ink-muted">
          Sem conta, a pessoa ainda pode voltar por uma janela anônima.
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
