import type { Participant } from "livekit-client";
import { Crown, LockKeyhole } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NavPopover } from "@/components/shell/NavBar";
import { ChoiceSelect } from "@/components/ChoiceSelect";
import { Field } from "@/components/Field";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { participantName } from "@/features/room/domain/participant-label";
import { sharePolicySchema } from "@/features/room/domain/host-controls";
import { useRoomHost } from "./RoomHostProvider";

/** Ending the call: an ownerless ad hoc room closes for good, any other stays for the next call. */
function CloseCallDialog({
  endsRoom,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endsRoom: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      {...props}
      title={endsRoom ? "Encerrar sala para todos?" : "Encerrar chamada para todos?"}
      description={
        endsRoom
          ? "A chamada termina para todas as pessoas e este código deixa de funcionar. Para outra chamada, crie uma sala nova."
          : "A chamada termina para todas as pessoas. O link continua valendo para a próxima."
      }
      confirmLabel={endsRoom ? "Encerrar sala" : "Encerrar chamada"}
      danger
    />
  );
}

const POLICY_OPTIONS = [
  { value: "everyone", label: "Todas as pessoas" },
  { value: "host", label: "Só quem controla a chamada" },
  { value: "selected", label: "Pessoas escolhidas" },
] as const;

/** Who may share the screen: everyone, only the host, or the people ticked below. */
function SharingRules({
  participants,
  disabled,
}: {
  participants: Participant[];
  disabled: boolean;
}) {
  const host = useRoomHost();
  const policyId = useId();
  const state = host.state;
  if (!state) return null;
  const present = (identity: string) => participants.some((person) => person.identity === identity);
  const toggle = (identity: string, allowed: boolean) =>
    host.execute({
      kind: "sharing",
      policy: "selected",
      allowed: allowed
        ? [...state.allowed, identity]
        : state.allowed.filter((other) => other !== identity),
    });
  return (
    <>
      <Field id={policyId} label="Quem pode compartilhar tela" size="compact">
        <ChoiceSelect
          id={policyId}
          value={state.policy}
          disabled={disabled}
          className="w-full bg-surface-2"
          options={POLICY_OPTIONS}
          onValueChange={(policy) =>
            host.execute({
              kind: "sharing",
              policy: sharePolicySchema.parse(policy),
              allowed: state.allowed.filter(present),
            })
          }
        />
      </Field>
      {state.policy === "selected" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs text-ink-muted">
            Quem controla a chamada sempre pode compartilhar.
          </legend>
          {participants
            .filter((person) => !person.isLocal)
            .map((person) => (
              <div key={person.identity} className="flex min-w-0 items-center gap-2 text-sm">
                <Checkbox
                  id={`${policyId}-${person.identity}`}
                  disabled={disabled}
                  checked={state.allowed.includes(person.identity)}
                  onCheckedChange={(checked) => toggle(person.identity, checked === true)}
                />
                <Label htmlFor={`${policyId}-${person.identity}`} className="truncate font-normal">
                  {participantName(person)}
                </Label>
              </div>
            ))}
        </fieldset>
      ) : null}
    </>
  );
}

export function HostControlsMenu({ participants }: { participants: Participant[] }) {
  const host = useRoomHost();
  const lockId = useId();
  const [closing, setClosing] = useState(false);
  const state = host.state;
  if (!state) return null;
  if (state.commands.length === 0)
    return state.locked ? (
      <Hint text="Novas entradas bloqueadas">
        <span className="px-1 text-warning">
          <LockKeyhole className="size-4" aria-hidden="true" />
          <span className="sr-only">Novas entradas bloqueadas</span>
        </span>
      </Hint>
    ) : null;
  const disabled = host.busy || !host.available;
  // A room someone owns, or a permanent one, stays for the next call.
  const endsRoom = state.endsRoom;
  return (
    <>
      <NavPopover
        label="Controles do anfitrião"
        iconOnly
        align="end"
        trigger={<Crown className="size-5" aria-hidden="true" />}
      >
        <div className="flex max-h-[min(32rem,calc(100dvh-8rem))] flex-col gap-4 overflow-y-auto overscroll-contain">
          <p className="text-base font-medium">
            {state.isHost ? "Você controla a chamada" : "Você modera a sala"}
          </p>
          <div>
            <label htmlFor={lockId} className="flex items-center justify-between gap-3">
              <span>Bloquear novas entradas</span>
              <Switch
                id={lockId}
                checked={state.locked}
                disabled={disabled}
                onCheckedChange={(locked) => host.execute({ kind: "lock", locked })}
              />
            </label>
            <p className="mt-2 text-xs text-ink-muted">
              Quem já entrou pode reconectar. Quem foi removido continua bloqueado.
            </p>
          </div>
          <SharingRules participants={participants} disabled={disabled} />
          <p className="text-xs text-ink-muted">
            A restrição interrompe telas em andamento. Os microfones continuam disponíveis.
          </p>
          {state.pending || state.failed ? (
            <output className="text-sm text-warning">
              {state.failed
                ? "Regra salva; aguardando nova tentativa na chamada."
                : "Aplicando na chamada…"}
            </output>
          ) : null}
          {!host.available ? (
            <output className="text-sm text-warning">
              Aguarde a conexão para usar os controles.
            </output>
          ) : null}
          {state.commands.includes("close") ? (
            <Button variant="destructive" disabled={disabled} onClick={() => setClosing(true)}>
              {endsRoom ? "Encerrar sala para todos" : "Encerrar chamada para todos"}
            </Button>
          ) : null}
        </div>
      </NavPopover>
      <CloseCallDialog
        open={closing}
        onOpenChange={setClosing}
        endsRoom={endsRoom}
        pending={disabled}
        onConfirm={() => {
          host.execute({ kind: "close" });
          setClosing(false);
        }}
      />
    </>
  );
}
