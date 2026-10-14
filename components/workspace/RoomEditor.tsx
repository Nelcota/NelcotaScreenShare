import { useId, useState } from "react";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formText } from "@/lib/utils";
import { Field } from "@/components/Field";

export interface RoomValues {
  name: string;
  allowGuests: boolean;
  memberCanHost: boolean;
}

/** The same rule as the server's workspace name (trimmed, at least 2 characters). */
function nameProblem(name: string): string | undefined {
  if (name.trim().length < 2) return "Use pelo menos 2 caracteres.";
  return undefined;
}

export function RoomEditor({
  initial,
  team,
  pending,
  error,
  onSave,
}: {
  initial?: RoomValues;
  team: boolean;
  pending: boolean;
  /** The server's message for the name, shown under the field. */
  error?: string;
  onSave: (values: RoomValues) => void;
}) {
  const id = useId();
  // Only spaces pass the browser's minLength; the server trims and refuses them too.
  const [nameError, setNameError] = useState<string>();
  const shownError = nameError ?? error;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = formText(data, "name").trim();
        const problem = nameProblem(name);
        if (problem) return setNameError(problem);
        setNameError(undefined);
        onSave({
          name,
          allowGuests: data.get("guests") === "on",
          memberCanHost: data.get("host") === "on",
        });
      }}
    >
      <Field
        id={id}
        label="Nome da sala"
        footer={<FormError id={`${id}-error`} message={shownError} />}
      >
        <Input
          name="name"
          defaultValue={initial?.name}
          minLength={2}
          maxLength={80}
          required
          placeholder="Reunião semanal"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? `${id}-error` : undefined}
          onChange={() => setNameError(undefined)}
        />
      </Field>
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
