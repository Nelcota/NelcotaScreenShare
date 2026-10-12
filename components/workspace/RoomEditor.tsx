import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formText } from "@/lib/utils";

export interface RoomValues {
  name: string;
  allowGuests: boolean;
  memberCanHost: boolean;
}
export function RoomEditor({
  initial,
  team,
  pending,
  onSave,
}: {
  initial?: RoomValues;
  team: boolean;
  pending: boolean;
  onSave: (values: RoomValues) => void;
}) {
  const id = useId();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSave({
          name: formText(data, "name"),
          allowGuests: data.get("guests") === "on",
          memberCanHost: data.get("host") === "on",
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Nome da sala</Label>
        <Input
          id={id}
          name="name"
          defaultValue={initial?.name}
          minLength={2}
          maxLength={80}
          required
          placeholder="Reunião semanal"
        />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="guests"
          defaultChecked={initial?.allowGuests ?? !team}
          className="mt-1"
        />
        <span>
          Permitir convidados pelo link
          <p className="mt-1 text-xs text-ink-muted">
            Convidados só entram depois que a chamada começar.
          </p>
        </span>
      </label>
      {team ? (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="host"
            defaultChecked={initial?.memberCanHost ?? false}
            className="mt-1"
          />
          <span>
            Membros podem iniciar e assumir a chamada
            <p className="mt-1 text-xs text-ink-muted">
              Donos e gestores sempre podem ser anfitriões.
            </p>
          </span>
        </label>
      ) : null}
      <Button disabled={pending} type="submit">
        {initial ? "Salvar sala" : "Criar sala"}
      </Button>
    </form>
  );
}
