import { KeyRound, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useRevalidator } from "react-router";

import { useId, useState, type FormEvent } from "react";
import { AuthCard } from "./AuthCard";
import { useFormError } from "./use-form-error";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callAuth } from "@/features/auth/client/auth-call";
import { adminAuthClient } from "@/features/auth/client/admin-auth-client";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import { formText } from "@/lib/utils";

/** Second factor at sign-in (authenticator app or backup code). */
export function TwoFactorCodeForm({
  scope,
  doneHref,
  backHref,
}: {
  scope: "admin" | "user";
  doneHref: string;
  backHref: string;
}) {
  const client = scope === "admin" ? adminAuthClient : authClient;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const codeId = useId();
  const errorId = useId();
  const [backup, setBackup] = useState(false);
  const [error, setError] = useFormError();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const code = formText(new FormData(event.currentTarget), "code").replaceAll(" ", "");
    setPending(true);
    setError(undefined);
    const { error: failure } = backup
      ? await callAuth(() => client.twoFactor.verifyBackupCode({ code }))
      : await callAuth(() => client.twoFactor.verifyTotp({ code }));
    if (failure) {
      setPending(false);
      setError(authErrorMessage(failure, "Código inválido. Confira e tente de novo."));
      return;
    }
    void navigate(doneHref, { replace: true, viewTransition: true });
    void revalidator.revalidate();
  }

  return (
    <AuthCard
      icon={backup ? KeyRound : ShieldCheck}
      title="Verificação em duas etapas"
      description={
        backup
          ? "Digite um dos códigos de backup que você guardou. Cada código vale uma vez."
          : "Digite o código de 6 dígitos do seu app autenticador."
      }
      footer={
        <Link viewTransition to={backHref} className="font-medium text-brand-soft hover:underline">
          Voltar para entrar
        </Link>
      }
    >
      <form
        method="post"
        key={backup ? "backup" : "totp"}
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="mode" value={backup ? "backup" : "totp"} />
        <div className="flex flex-col gap-2">
          <Label htmlFor={codeId}>{backup ? "Código de backup" : "Código"}</Label>
          <Input
            id={codeId}
            name="code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode={backup ? "text" : "numeric"}
            pattern={backup ? undefined : "[0-9]{6}"}
            maxLength={backup ? 32 : 6}
            className="h-12 text-center text-lg font-semibold tracking-[0.3em]"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        <FormError id={errorId} message={error} />
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Verificar
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setBackup((value) => !value);
            setError(undefined);
          }}
        >
          {backup ? "Usar o código do app" : "Perdi o acesso ao app: usar código de backup"}
        </Button>
      </form>
    </AuthCard>
  );
}
