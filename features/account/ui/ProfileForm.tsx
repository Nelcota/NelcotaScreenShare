import { useRevalidator } from "react-router";

import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callAuth } from "@/features/auth/client/auth-call";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import { displayNameSchema } from "@/features/room/domain/participant-label";
import { formText } from "@/lib/utils";

/** Name shown in the room. */
export function ProfileForm({ name }: { name: string }) {
  const revalidator = useRevalidator();
  const nameId = useId();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState(name);
  const unchanged = value.trim() === name;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = displayNameSchema.safeParse(formText(new FormData(event.currentTarget), "name"));
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira seu nome.");
    setPending(true);
    setError(undefined);
    const { error: failure } = await callAuth(() => authClient.updateUser({ name: parsed.data }));
    setPending(false);
    if (failure) return setError(authErrorMessage(failure));
    toast.success("Nome atualizado. Vale a partir da próxima sala.");
    void revalidator.revalidate();
  }

  return (
    <form
      method="post"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      className="flex flex-col gap-2"
    >
      <Label htmlFor={nameId} className="sr-only">
        Nome na sala
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={nameId}
          name="name"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(undefined);
          }}
          maxLength={32}
          required
          aria-invalid={error ? true : undefined}
          className="h-10 min-w-0 flex-1 basis-48"
        />
        <Button type="submit" loading={pending} disabled={unchanged}>
          Salvar
        </Button>
      </div>
      <FormError message={error} />
    </form>
  );
}
