import { useLocalParticipant, useParticipantAttribute } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { useState } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { Crown, Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changeRoomRole } from "@/features/room/client/api";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import type { RoleChange } from "@/features/room/domain/role-change";
import { parseRoomRole, ROLE_ATTRIBUTE } from "@/features/room/domain/room-role";
import { CardMenuItem } from "./CardMenuItem";

const DONE: Record<RoleChange, (name: string) => string> = {
  promote: (name) => `${name} agora modera a sala.`,
  demote: (name) => `${name} não modera mais a sala.`,
  transfer: (name) => `A sala agora é de ${name}.`,
};

/** Only the owner sees role actions, and only for other people with an account. */
function useCanChangeRoles(participant: Participant): boolean {
  const { localParticipant } = useLocalParticipant();
  const myRole = parseRoomRole(
    useParticipantAttribute(ROLE_ATTRIBUTE, { participant: localParticipant }),
  );
  return myRole === "owner" && !participant.isLocal && !isGuestIdentity(participant.identity);
}

/**
 * On someone's card, for the owner: make them a moderator or take it back, and hand the
 * room over. Handing over asks first, since the owner then stays only as a moderator.
 */
export function CardRoles({
  participant,
  roomCode,
}: {
  participant: Participant;
  roomCode: string;
}) {
  const canChange = useCanChangeRoles(participant);
  const theirRole = parseRoomRole(useParticipantAttribute(ROLE_ATTRIBUTE, { participant }));
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!canChange) return null;
  const name = participant.name || participant.identity;

  async function change(kind: RoleChange) {
    setBusy(true);
    const result = await changeRoomRole(roomCode, participant.identity, kind);
    setBusy(false);
    setConfirmingTransfer(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(DONE[kind](name));
  }

  if (confirmingTransfer) {
    return (
      <div role="alertdialog" aria-label={`Transferir a sala para ${name}?`} className="px-1 pt-1">
        <p className="text-base font-medium">Transferir a sala para {name}?</p>
        <p className="mt-1 text-sm text-ink-muted">Você continua moderando.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirmingTransfer(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy} onClick={() => void change("transfer")}>
            Transferir
          </Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <CardMenuItem
        icon={theirRole === "moderator" ? <ShieldOff /> : <Shield />}
        disabled={busy}
        onClick={() => void change(theirRole === "moderator" ? "demote" : "promote")}
      >
        {theirRole === "moderator" ? "Tirar moderador" : "Tornar moderador"}
      </CardMenuItem>
      <CardMenuItem icon={<Crown />} disabled={busy} onClick={() => setConfirmingTransfer(true)}>
        Transferir a sala
      </CardMenuItem>
    </>
  );
}
