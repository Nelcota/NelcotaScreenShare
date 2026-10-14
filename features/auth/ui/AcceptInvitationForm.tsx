import { UserPlus } from "lucide-react";

import { useOperation } from "@/lib/operations/use-operation";
import { useId, type FormEvent } from "react";
import { acceptInvitation } from "@/features/auth/actions";
import { AuthCard } from "./AuthCard";
import { useFormError } from "./use-form-error";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newPasswordError, PASSWORD_LIMITS } from "@/features/auth/domain/password-rules";
import { formText } from "@/lib/utils";
import { Field } from "@/components/Field";

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
        <Field id={nameId} label="Seu nome">
          <Input name="name" autoComplete="name" required maxLength={80} className="h-11" />
        </Field>
        <Field id={passwordId} label={<>Senha (pelo menos {MIN} caracteres)</>}>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN}
            maxLength={PASSWORD_LIMITS.admin.max}
          />
        </Field>
        <Field id={confirmId} label="Repita a senha">
          <PasswordInput name="confirm" autoComplete="new-password" required />
        </Field>
        <FormError message={localError ?? serverError} />
        <Button type="submit" size="lg" loading={accept.isPending} className="w-full">
          Criar acesso
        </Button>
      </form>
    </AuthCard>
  );
}
