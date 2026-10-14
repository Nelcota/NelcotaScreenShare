import { LockKeyhole } from "lucide-react";
import { Link, useNavigate, useRevalidator } from "react-router";

import { useId, useState, type FormEvent } from "react";
import { AuthCard } from "./AuthCard";
import { useFormError } from "./use-form-error";
import { FormNotice } from "./FormNotice";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callAuth } from "@/features/auth/client/auth-call";
import { adminAuthClient } from "@/features/auth/client/admin-auth-client";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import { formText } from "@/lib/utils";

export function AdminSignInForm({ notice }: { notice?: string | undefined }) {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [error, setError] = useFormError();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const { data: result, error: failure } = await callAuth(() =>
      adminAuthClient.signIn.email({
        email: formText(data, "email"),
        password: formText(data, "password"),
      }),
    );
    if (failure) {
      setPending(false);
      setError(authErrorMessage(failure));
      return;
    }
    // With 2FA active, the plugin redirects to /admin/verificar-2fa.
    if (result && "twoFactorRedirect" in result && result.twoFactorRedirect) return;
    void navigate("/admin", { replace: true, viewTransition: true });
    void revalidator.revalidate();
  }

  return (
    <AuthCard
      icon={LockKeyhole}
      title="Entrar no painel"
      description="Acesso restrito à equipe do Nelcota."
      footer={
        <Link
          viewTransition
          to="/admin/recuperar-senha"
          className="font-medium text-brand-soft hover:underline"
        >
          Esqueci minha senha
        </Link>
      }
    >
      <form
        method="post"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormNotice message={notice} />
        <div className="flex flex-col gap-2">
          <Label htmlFor={emailId}>E-mail</Label>
          <Input
            id={emailId}
            name="email"
            type="email"
            autoComplete="username"
            required
            className="h-11"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={passwordId}>Senha</Label>
          <PasswordInput
            id={passwordId}
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        <FormError id={errorId} message={error} />
        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
          Entrar
        </Button>
      </form>
    </AuthCard>
  );
}
