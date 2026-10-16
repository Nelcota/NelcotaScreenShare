import { Loader2, UserPlus } from "lucide-react";

import { useOperation } from "@/lib/operations/use-operation";
import { useId, type FormEvent } from "react";
import { acceptInvitation } from "@/features/auth/actions";
import { AuthCard } from "./AuthCard";
import { useFormError } from "./use-form-error";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newPasswordError, PASSWORD_LIMITS } from "@/features/auth/domain/password-rules";
import { formText } from "@/lib/utils";

const MIN = PASSWORD_LIMITS.admin.min;

export function AcceptInvitationForm({
  token,
  email,
  roleLabel,
}: {
  token: string;
  email: string;
  roleLabel: string;
}) {
  const nameId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const [localError, setLocalError] = useFormError();
  const accept = useOperation(acceptInvitation);
  const serverError =
    accept.result.serverError ??
    (accept.result.validationErrors ? "Confira os campos e tente de novo." : undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = formText(data, "password");
    const invalid = newPasswordError(password, formText(data, "confirm"), MIN);
    setLocalError(invalid);
    if (invalid) return;
    accept.execute({ token, name: formText(data, "name"), password });
  }

  return (
    <AuthCard
      icon={UserPlus}
      title="Criar acesso ao painel"
      description={
        <>
          Convite para <strong className="text-ink">{email}</strong> como{" "}
          <strong className="text-ink">{roleLabel}</strong>. Depois de criar a senha, você vai
          configurar a verificação em duas etapas.
        </>
      }
    >
      <form method="post" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={nameId}>Seu nome</Label>
          <Input
            id={nameId}
            name="name"
            autoComplete="name"
            required
            maxLength={80}
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={passwordId}>Senha (pelo menos {MIN} caracteres)</Label>
          <PasswordInput
            id={passwordId}
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN}
            maxLength={PASSWORD_LIMITS.admin.max}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={confirmId}>Repita a senha</Label>
          <PasswordInput id={confirmId} name="confirm" autoComplete="new-password" required />
        </div>
        <FormError message={localError ?? serverError} />
        <Button type="submit" size="lg" disabled={accept.isPending} className="w-full">
          {accept.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Criar acesso
        </Button>
      </form>
    </AuthCard>
  );
}
