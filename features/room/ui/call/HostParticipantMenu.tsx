import type { Participant } from "livekit-client";
import { Ellipsis } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { isGuestIdentity, participantName } from "@/features/room/domain/participant-label";
import { useLocalParticipant, useParticipantAttribute } from "@livekit/components-react";
import { canModerate } from "@/features/room/domain/moderation";
import { parseRoomRole, ROLE_ATTRIBUTE, type RoomRole } from "@/features/room/domain/room-role";
import type { RoomControlState } from "@/features/room/domain/host-controls";
import { useRoomHost } from "./RoomHostProvider";

/** What I may do to this person: the host and the owner anything; a moderator, participants only. */
function commandsOn(
  state: RoomControlState,
  participant: Participant,
  roles: { mine: RoomRole; theirs: RoomRole },
) {
  const fullHost = state.commands.includes("transfer");
  const theirRole = roles.theirs;
  const coHostMayRemove =
    canModerate("moderator", theirRole) && participant.identity !== state.hostIdentity;
  return {
    // The owner hands over the whole room from the card ("Transferir a sala").
    mayTransfer: fullHost && roles.mine !== "owner" && !isGuestIdentity(participant.identity),
    mayRemove: state.commands.includes("remove") && (fullHost || coHostMayRemove),
  };
}

export function HostParticipantMenu({ participant }: { participant: Participant }) {
  const host = useRoomHost();
  const [confirmation, setConfirmation] = useState<"remove" | "transfer">();
  const [open, setOpen] = useState(false);
  const name = participantName(participant);
  const theirRole = parseRoomRole(useParticipantAttribute(ROLE_ATTRIBUTE, { participant }));
  const { localParticipant } = useLocalParticipant();
  const myRole = parseRoomRole(
    useParticipantAttribute(ROLE_ATTRIBUTE, { participant: localParticipant }),
  );
  const state = host.state;
  if (!state || participant.isLocal) return null;
  const { mayTransfer, mayRemove } = commandsOn(state, participant, {
    mine: myRole,
    theirs: theirRole,
  });
  if (!mayTransfer && !mayRemove) return null;
  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          disabled={!host.available || host.busy}
          aria-label={`Moderar ${name}`}
          className="glass relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-ink-muted disabled:opacity-50"
        >
          <Ellipsis className="size-4" aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="left"
            align="center"
            collisionPadding={16}
            className="glass z-50 flex w-[min(18rem,calc(100vw-2rem))] flex-col gap-2 rounded-2xl p-3"
          >
            {mayTransfer ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setConfirmation("transfer");
                }}
              >
                Transferir anfitrião
              </Button>
            ) : null}
            {mayRemove ? (
              <Button
                variant="destructive"
                onClick={() => {
                  setOpen(false);
                  setConfirmation("remove");
                }}
              >
                Remover da chamada
              </Button>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <ConfirmDialog
        open={confirmation !== undefined}
        onOpenChange={(next) => {
          if (!next) setConfirmation(undefined);
        }}
        title={confirmation === "remove" ? `Remover ${name}?` : `Transferir para ${name}?`}
        description={
          confirmation === "remove"
            ? "Esta identidade não poderá voltar a esta chamada. Convidados sem conta podem obter outra identidade ao limpar os cookies; bloqueie novas entradas se necessário."
            : "Esta pessoa assumirá os controles da sala. Você continuará na chamada como participante."
        }
        confirmLabel={confirmation === "remove" ? "Remover pessoa" : "Transferir função"}
        danger={confirmation === "remove"}
        pending={host.busy || !host.available}
        onConfirm={() => {
          if (!confirmation) return;
          host.execute({ kind: confirmation, identity: participant.identity });
          setConfirmation(undefined);
        }}
      />
    </>
  );
}
