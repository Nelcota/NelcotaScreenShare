import { LogIn } from "lucide-react";
import { Link, useNavigate, useRevalidator, useSearchParams } from "react-router";

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
import { twoFactorStep } from "@/features/auth/domain/participant-sign-in-next";
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
  const [searchParams] = useSearchParams();
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
    // With 2FA the code comes next; an in-app navigation keeps a call going.
    const codePage = twoFactorStep(result, searchParams.get("voltar"));
    if (codePage) {
      nodMascot();
      void navigate(codePage, { replace: true, viewTransition: true });
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
        {/* The link sits beside the label but comes after the field: Tab goes e-mail → senha. */}
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-2 gap-y-2">
          <Label htmlFor={passwordId}>Senha</Label>
          <div className="col-span-2 row-start-2">
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
          <Link
            viewTransition
            to="/recuperar-senha"
            className="col-start-2 row-start-1 text-sm font-medium text-brand-soft hover:underline"
          >
            Esqueci a senha
          </Link>
        </div>
        <FormError id={errorId} message={error} />
        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
          Entrar
        </Button>
      </form>
    </AuthCard>
  );
}
