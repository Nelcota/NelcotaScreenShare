import { useRevalidator } from "react-router";

import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { callAuth } from "@/features/auth/client/auth-call";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import { newPasswordError, PASSWORD_LIMITS } from "@/features/auth/domain/password-rules";
import { formText } from "@/lib/utils";
import { useCloseRow } from "./settings/ExpandableRow";
import { Field } from "@/components/Field";

export function ChangePasswordForm() {
  const revalidator = useRevalidator();
  const ids = { current: useId(), next: useId(), confirm: useId() };
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const closeRow = useCloseRow();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = formText(data, "next");
    const invalid = newPasswordError(
      newPassword,
      formText(data, "confirm"),
      PASSWORD_LIMITS.user.min,
    );
    if (invalid) return setError(invalid);
    setPending(true);
    setError(undefined);
    const { error: failure } = await callAuth(() =>
      authClient.changePassword({
        currentPassword: formText(data, "current"),
        newPassword,
        revokeOtherSessions: true,
      }),
    );
    setPending(false);
    if (failure) return setError(authErrorMessage(failure, "Senha atual incorreta."));
    form.reset();
    closeRow?.();
    toast.success("Senha alterada. As outras sessões foram encerradas.");
    void revalidator.revalidate();
  }

  return (
    <form
      method="post"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      className="grid max-w-sm gap-3"
    >
      <Field id={ids.current} label="Senha atual">
        <PasswordInput name="current" autoComplete="current-password" required />
      </Field>
      <Field
        id={ids.next}
        label="Nova senha"
        hint={`Pelo menos ${PASSWORD_LIMITS.user.min} caracteres.`}
      >
        <PasswordInput
          name="next"
          autoComplete="new-password"
          required
          minLength={PASSWORD_LIMITS.user.min}
          maxLength={PASSWORD_LIMITS.user.max}
        />
      </Field>
      <Field id={ids.confirm} label="Repita a nova senha">
        <PasswordInput name="confirm" autoComplete="new-password" required />
      </Field>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Salvar nova senha
        </Button>
        {closeRow ? (
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => {
              event.currentTarget.form?.reset();
              setError(undefined);
              closeRow();
            }}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
