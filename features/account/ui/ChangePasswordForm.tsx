import { useRevalidator } from "react-router";

import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { callAuth } from "@/features/auth/client/auth-call";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import { newPasswordError, PASSWORD_LIMITS } from "@/features/auth/domain/password-rules";
import { formText } from "@/lib/utils";
import { useCloseRow } from "./settings/ExpandableRow";

export function ChangePasswordForm() {
  const revalidator = useRevalidator();
  const ids = { current: useId(), next: useId(), confirm: useId(), hint: useId() };
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
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.current}>Senha atual</Label>
        <PasswordInput id={ids.current} name="current" autoComplete="current-password" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.next}>Nova senha</Label>
        <PasswordInput
          id={ids.next}
          name="next"
          autoComplete="new-password"
          required
          minLength={PASSWORD_LIMITS.user.min}
          maxLength={PASSWORD_LIMITS.user.max}
          aria-describedby={ids.hint}
        />
        <p id={ids.hint} className="text-xs text-ink-muted">
          Pelo menos {PASSWORD_LIMITS.user.min} caracteres.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.confirm}>Repita a nova senha</Label>
        <PasswordInput id={ids.confirm} name="confirm" autoComplete="new-password" required />
      </div>
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
