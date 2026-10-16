import { useId, useState } from "react";
import { Field } from "@/components/Field";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formText } from "@/lib/utils";
import { workspaceNameSchema } from "@/features/rooms/domain/commands";

/** Renames the team; a refused name says why under the field, the server's one included. */
export function TeamNameForm({
  name,
  pending,
  error,
  onRename,
}: {
  name: string;
  pending: boolean;
  error?: string;
  onRename: (name: string) => void;
}) {
  const id = useId();
  const [nameError, setNameError] = useState<string>();
  const shownError = nameError ?? error;
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = workspaceNameSchema.safeParse(
          formText(new FormData(event.currentTarget), "name"),
        );
        if (!parsed.success) return setNameError(parsed.error.issues[0]?.message);
        setNameError(undefined);
        onRename(parsed.data);
      }}
    >
      <Field
        id={id}
        label="Nome do time"
        footer={<FormError id={`${id}-error`} message={shownError} />}
      >
        <Input
          key={name}
          name="name"
          defaultValue={name}
          minLength={2}
          maxLength={80}
          required
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? `${id}-error` : undefined}
          onChange={() => setNameError(undefined)}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        Salvar nome
      </Button>
    </form>
  );
}
