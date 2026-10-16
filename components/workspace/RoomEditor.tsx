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
  /** Chosen address, only when creating; none means one is drawn. */
  code?: string;
  allowGuests: boolean;
  memberCanHost: boolean;
}

/** The same rule as the server's workspace name (trimmed, at least 2 characters). */
function nameProblem(name: string): string | undefined {
  if (name.trim().length < 2) return "Use pelo menos 2 caracteres.";
  return undefined;
}

/** Where the room will live, before the code: this site's address and /sala/. */
function addressPrefix(): string {
  if (typeof window === "undefined") return "/sala/";
  return `${window.location.host}/sala/`;
}

/** The address a new permanent room takes; it cannot change later. */
function AddressField({ error, onChange }: { error: string | undefined; onChange: () => void }) {
  const id = useId();
  return (
    <Field
      id={id}
      label="Endereço"
      hint="Letras minúsculas, números e hífen. Não dá para mudar depois."
      footer={<FormError id={`${id}-error`} message={error} />}
    >
      {/* The prefix sits inside the box, so the input is wrapped: the field hands it its id. */}
      {(control) => (
        <div className="flex h-11 items-center rounded-xl border border-input bg-surface-2 pl-3.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40">
          <span className="shrink-0 text-sm text-ink-subtle" aria-hidden="true">
            {addressPrefix()}
          </span>
          <Input
            id={control.id}
            name="code"
            maxLength={32}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="sala-do-time"
            // The box around it carries the border, focus and error, prefix included.
            className="h-full border-0 bg-transparent pl-0 shadow-none focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent"
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error ? `${control["aria-describedby"]} ${id}-error` : control["aria-describedby"]
            }
            onChange={onChange}
          />
        </div>
      )}
    </Field>
  );
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
  addressError,
  checkAddress,
  onSave,
}: {
  initial?: RoomValues;
  team: boolean;
  pending: boolean;
  /** The server's message for the name, shown under the field. */
  error?: string;
  /** The server's message for the chosen address (taken, reserved), under its field. */
  addressError?: string;
  /** The address rule (an empty address is always fine); without it, there is no address field. */
  checkAddress?: (code: string) => string | undefined;
  onSave: (values: RoomValues) => void;
}) {
  const id = useId();
  // Only spaces pass the browser's minLength; the server trims and refuses them too.
  const [nameError, setNameError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const shownError = nameError ?? error;
  const choosesAddress = initial === undefined && checkAddress !== undefined;
  const addressProblem = (code: string) => (code === "" ? undefined : checkAddress?.(code));
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = formText(data, "name").trim();
        const code = formText(data, "code").trim().toLowerCase();
        const problem = nameProblem(name);
        setNameError(problem);
        setCodeError(addressProblem(code));
        if (problem || addressProblem(code)) return;
        onSave({
          name,
          code: code === "" ? undefined : code,
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
      {choosesAddress ? (
        <AddressField error={codeError ?? addressError} onChange={() => setCodeError(undefined)} />
      ) : null}
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
