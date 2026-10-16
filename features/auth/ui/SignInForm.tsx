import { Loader2, LogIn } from "lucide-react";
import { Link, useNavigate, useRevalidator } from "react-router";

import { useId, useRef, useState, type FormEvent } from "react";
import { AccessTabs } from "./AccessTabs";
import { EmailField, forgetTypedEmail } from "./EmailField";
import { AuthCard } from "./AuthCard";
import { useFormError } from "./use-form-error";
import { FormNotice } from "./FormNotice";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { celebrateMascot, nodMascot, upsetMascot } from "@/features/mascot/client/events";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AccessContext } from "@/features/auth/domain/access-context";
import { callAuth } from "@/features/auth/client/auth-call";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import { formText } from "@/lib/utils";

/** Errors the person caused (credentials) make the mascot angry; the rest, worried. */
const OWN_FAULT = new Set(["INVALID_EMAIL_OR_PASSWORD", "FAILED_TO_CREATE_SESSION"]);

export function SignInForm({
  returnTo,
  context,
  notice,
}: {
  returnTo: string;
  context: AccessContext;
  notice?: string | undefined;
}) {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useFormError();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = formText(data, "email").trim();
    const password = formText(data, "password");
    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      upsetMascot("grumpy", (email ? passwordRef.current : null) ?? undefined);
      return;
    }
    setPending(true);
    setError(undefined);
    const { data: result, error: failure } = await callAuth(() =>
      authClient.signIn.email({
        email,
        password,
        callbackURL: returnTo,
      }),
    );
    if (failure) {
      setPending(false);
      setError(authErrorMessage(failure));
      if (failure.code && OWN_FAULT.has(failure.code)) {
        upsetMascot("grumpy", passwordRef.current ?? undefined);
        passwordRef.current?.select();
        return;
      }
      upsetMascot("worried");
      return;
    }
    forgetTypedEmail();
    // With 2FA, Better Auth goes to /entrar/2fa (the client's onTwoFactorRedirect).
    if (result && "twoFactorRedirect" in result && result.twoFactorRedirect) {
      nodMascot();
      return;
    }
    celebrateMascot();
    void navigate(returnTo, { replace: true, viewTransition: true });
    void revalidator.revalidate();
  }

  return (
    <AuthCard
      icon={LogIn}
      title="Entre na sua conta"
      description={
        context.kind === "room"
          ? "Depois de entrar, você volta para a sala."
          : "Para criar salas e compartilhar a tela."
      }
      top={<AccessTabs current="entrar" returnTo={returnTo} />}
    >
      <form
        method="post"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormNotice message={notice} />
        <EmailField
          id={emailId}
          autoComplete="username"
          invalid={error !== undefined}
          describedBy={error ? errorId : undefined}
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor={passwordId}>Senha</Label>
            <Link
              viewTransition
              to="/recuperar-senha"
              className="text-sm font-medium text-brand-soft hover:underline"
            >
              Esqueci a senha
            </Link>
          </div>
          <PasswordInput
            ref={passwordRef}
            id={passwordId}
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        <FormError id={errorId} message={error} />
        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Entrar
        </Button>
      </form>
    </AuthCard>
  );
}
