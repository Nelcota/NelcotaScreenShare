import type { Participant } from "livekit-client";
import { Crown, LockKeyhole } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NavPopover } from "@/components/shell/NavBar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { participantName } from "@/features/room/domain/participant-label";
import { sharePolicySchema } from "@/features/room/domain/host-controls";
import { useRoomHost } from "./RoomHostProvider";

export function HostControlsMenu({ participants }: { participants: Participant[] }) {
  const host = useRoomHost();
  const lockId = useId();
  const policyId = useId();
  const [closing, setClosing] = useState(false);
  const state = host.state;
  if (!state) return null;
  if (!state.isHost)
    return state.locked ? (
      <span title="Novas entradas bloqueadas" className="px-1 text-warning">
        <LockKeyhole className="size-4" />
        <span className="sr-only">Novas entradas bloqueadas</span>
      </span>
    ) : null;
  const disabled = host.busy || !host.available;
  return (
    <>
      <NavPopover
        label="Controles do anfitrião"
        iconOnly
        align="end"
        trigger={<Crown className="size-5" aria-hidden="true" />}
      >
        <div className="flex max-h-[min(32rem,calc(100dvh-8rem))] flex-col gap-4 overflow-y-auto overscroll-contain">
          <p className="text-base font-medium">Você é o anfitrião</p>
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
          <div>
            <label htmlFor={policyId} className="mb-2 block text-sm font-medium">
              Quem pode compartilhar tela
            </label>
            <select
              id={policyId}
              value={state.policy}
              disabled={disabled}
              className="w-full rounded-xl border border-line bg-surface-2 p-2 text-sm"
              onChange={(event) =>
                host.execute({
                  kind: "sharing",
                  policy: sharePolicySchema.parse(event.target.value),
                  allowed: state.allowed.filter((identity) =>
                    participants.some((person) => person.identity === identity),
                  ),
                })
              }
            >
              <option value="everyone">Todas as pessoas</option>
              <option value="host">Só o anfitrião</option>
              <option value="selected">Pessoas escolhidas</option>
            </select>
          </div>
          {state.policy === "selected" ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs text-ink-muted">
                O anfitrião sempre pode compartilhar.
              </legend>
              {participants
                .filter((person) => !person.isLocal)
                .map((person) => (
                  <label key={person.identity} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={state.allowed.includes(person.identity)}
                      onChange={(event) =>
                        host.execute({
                          kind: "sharing",
                          policy: "selected",
                          allowed: event.target.checked
                            ? [...state.allowed, person.identity]
                            : state.allowed.filter((identity) => identity !== person.identity),
                        })
                      }
                    />{" "}
                    <span className="truncate">{participantName(person)}</span>
                  </label>
                ))}
            </fieldset>
          ) : null}
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
          <Button variant="destructive" disabled={disabled} onClick={() => setClosing(true)}>
            {state.permanent ? "Encerrar chamada para todos" : "Encerrar sala para todos"}
          </Button>
        </div>
      </NavPopover>
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={state.permanent ? "Encerrar chamada para todos?" : "Encerrar sala para todos?"}
        description={
          state.permanent
            ? "Todos serão desconectados. O link continuará disponível para uma nova chamada."
            : "Todos serão desconectados e este código ficará encerrado. Crie outra sala para uma nova chamada."
        }
        confirmLabel={state.permanent ? "Encerrar chamada" : "Encerrar sala"}
        danger
        pending={disabled}
        onConfirm={() => {
          host.execute({ kind: "close" });
          setClosing(false);
        }}
      />
    </>
  );
}
