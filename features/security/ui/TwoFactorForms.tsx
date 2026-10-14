import type { FormEvent } from "react";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Feedback shared by every 2FA form: one error message and one pending request. */
export type TwoFactorFormState = {
  error: string | undefined;
  pending: boolean;
  errorId: string;
  invalidField: string | undefined;
};

export type SubmitHandler = (event: FormEvent<HTMLFormElement>) => Promise<void>;

export function ManageTwoFactorForms({
  passwordId,
  required,
  state,
  onRegenerate,
  onDisable,
}: {
  passwordId: string;
  /** The role requires 2FA: the disable form is hidden. */
  required: boolean;
  state: TwoFactorFormState;
  onRegenerate: SubmitHandler;
  onDisable: SubmitHandler;
}) {
  const disablePasswordId = `${passwordId}-off`;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form
        method="post"
        noValidate
        onSubmit={(event) => void onRegenerate(event)}
        className="flex flex-col gap-3"
      >
        <h3 className="font-medium">Novos códigos de backup</h3>
        <p className="text-sm text-ink-muted">Os códigos antigos param de funcionar.</p>
        <PasswordField
          id={passwordId}
          invalid={state.invalidField === passwordId}
          errorId={state.errorId}
        />
        <Button type="submit" variant="outline" disabled={state.pending} className="self-start">
          Gerar novos códigos
        </Button>
      </form>
      {required ? null : (
        <form
          method="post"
          noValidate
          onSubmit={(event) => void onDisable(event)}
          className="flex flex-col gap-3"
        >
          <h3 className="font-medium">Desativar</h3>
          <p className="text-sm text-ink-muted">Depois disso, basta a senha para entrar.</p>
          <PasswordField
            id={disablePasswordId}
            invalid={state.invalidField === disablePasswordId}
            errorId={state.errorId}
          />
          <Button type="submit" variant="outline" disabled={state.pending} className="self-start">
            Desativar verificação
          </Button>
        </form>
      )}
      <div className="md:col-span-2">
        <FormError id={state.errorId} message={state.error} />
      </div>
    </div>
  );
}

export function EnableTwoFactorForm({
  passwordId,
  state,
  onSubmit,
}: {
  passwordId: string;
  state: TwoFactorFormState;
  onSubmit: SubmitHandler;
}) {
  return (
    <form
      method="post"
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-4 sm:max-w-sm"
    >
      <PasswordField
        id={passwordId}
        invalid={state.invalidField === passwordId}
        errorId={state.errorId}
      />
      <FormError id={state.errorId} message={state.error} />
      <Button type="submit" loading={state.pending} className="self-start">
        Ativar verificação
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  invalid,
  errorId,
}: {
  id: string;
  invalid: boolean;
  errorId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Confirme sua senha</Label>
      <PasswordInput
        id={id}
        name="password"
        autoComplete="current-password"
        required
        aria-invalid={invalid}
        aria-describedby={errorId}
      />
    </div>
  );
}
