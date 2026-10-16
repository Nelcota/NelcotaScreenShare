import { useId, useState } from "react";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/** A setting turned on or off, with what it means under it. */
function OptionCheckbox({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 text-sm">
      <Checkbox
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        aria-describedby={`${id}-hint`}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="leading-snug font-normal">
          {label}
        </Label>
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      </div>
    </div>
  );
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
      noValidate
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
      <OptionCheckbox
        name="guests"
        defaultChecked={initial?.allowGuests ?? !team}
        label="Permitir convidados pelo link"
        hint="Convidados só entram depois que a chamada começar."
      />
      {team ? (
        <OptionCheckbox
          name="host"
          defaultChecked={initial?.memberCanHost ?? false}
          label="Membros podem iniciar e assumir a chamada"
          hint="Donos e gestores sempre podem ser anfitriões."
        />
      ) : null}
      <Button disabled={pending} type="submit">
        {initial ? "Salvar sala" : "Criar sala"}
      </Button>
    </form>
  );
}
