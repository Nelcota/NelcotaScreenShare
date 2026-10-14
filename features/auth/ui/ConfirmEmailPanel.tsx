import { MailCheck } from "lucide-react";
import { useState } from "react";
import { AuthCard } from "./AuthCard";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { callAuth } from "@/features/auth/client/auth-call";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";

/** A verification link for a 2FA account resumes after a complete sign-in. */
export function ConfirmEmailPanel({
  confirmationHref,
  signInHref,
  signedIn,
}: {
  confirmationHref: string | null;
  signInHref: string;
  signedIn: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function signIn() {
    setPending(true);
    setError(undefined);
    if (signedIn) {
      const { error: failure } = await callAuth(() => authClient.signOut());
      if (failure) {
        setPending(false);
        setError(authErrorMessage(failure));
        return;
      }
    }
    window.location.assign(signInHref);
  }

  return (
    <AuthCard
      icon={MailCheck}
      title="Confirme seu e-mail"
      description={
        confirmationHref
          ? "Sua conta está autenticada. Confirme para concluir a atualização do e-mail."
          : "Para proteger sua conta, entre com sua senha e o código do app autenticador antes de confirmar este link."
      }
    >
      {confirmationHref ? (
        <Button asChild size="lg" className="w-full">
          <a href={confirmationHref}>Confirmar e-mail</a>
        </Button>
      ) : (
        <Button size="lg" loading={pending} onClick={() => void signIn()} className="w-full">
          {signedIn ? "Entrar na conta correta" : "Entrar para confirmar"}
        </Button>
      )}
      <FormError message={error} />
    </AuthCard>
  );
}
