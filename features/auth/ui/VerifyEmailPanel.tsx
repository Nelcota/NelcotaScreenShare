import { MailCheck } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import { AuthCard } from "./AuthCard";
import { celebrateMascot, upsetMascot } from "@/features/mascot/client/events";
import { Button } from "@/components/ui/button";
import { callAuth } from "@/features/auth/client/auth-call";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { inboxLink } from "@/features/auth/domain/email-suggest";
import { FormError } from "@/components/FormError";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";

/** The server accepts one resend per minute; the countdown avoids a refused click. */
const RESEND_COOLDOWN = 60;

/** After sign-up (or when trying to join a room without confirming the e-mail). */
export function VerifyEmailPanel({
  email,
  returnTo,
}: {
  email: string | undefined;
  returnTo: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "wait">("idle");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string>();
  const inbox = email ? inboxLink(email) : undefined;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    if (!email || cooldown > 0) return;
    setStatus("sending");
    setError(undefined);
    const { error: failure } = await callAuth(() =>
      authClient.sendVerificationEmail({
        email,
        callbackURL: returnTo,
      }),
    );
    if (failure?.status === 429) {
      setCooldown(RESEND_COOLDOWN);
      setStatus("wait");
      upsetMascot("worried");
      return;
    }
    if (failure) {
      setStatus("idle");
      setError(authErrorMessage(failure, "Não foi possível enviar o link. Tente de novo."));
      upsetMascot("worried");
      return;
    }
    setCooldown(RESEND_COOLDOWN);
    setStatus("sent");
    celebrateMascot();
  }

  return (
    <AuthCard
      icon={MailCheck}
      title="Confirme seu e-mail"
      description={
        email ? (
          <>
            Abra o e-mail de confirmação enviado para{" "}
            <strong className="break-all text-ink">{email}</strong> e toque em “Confirmar e-mail”. O
            link vale por 24 horas.
          </>
        ) : (
          "Abra o e-mail de confirmação e toque em “Confirmar e-mail”."
        )
      }
      footer={
        <Link
          viewTransition
          to={`/entrar?voltar=${encodeURIComponent(returnTo)}`}
          className="font-medium text-brand-soft hover:underline"
        >
          Já confirmei meu e-mail
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        {inbox ? (
          <Button asChild size="lg" className="w-full">
            <a href={inbox.href} target="_blank" rel="noopener noreferrer">
              <img
                src={inbox.logo}
                alt=""
                aria-hidden="true"
                data-icon="inline-start"
                width={20}
                height={20}
                className="shrink-0 object-contain"
              />
              {inbox.label}
            </a>
          </Button>
        ) : null}
        <p className="text-sm text-ink-subtle">Não chegou? Veja a caixa de spam e as promoções.</p>
        {email ? (
          <Button
            variant="outline"
            size="lg"
            loading={status === "sending"}
            disabled={cooldown > 0}
            onClick={() => void resend()}
          >
            {cooldown > 0 ? `Reenviar em ${cooldown} s` : "Reenviar link"}
          </Button>
        ) : null}
        <p aria-live="polite" className="text-sm">
          {status === "sent" ? (
            <span className="text-success">Link reenviado. Confira o e-mail.</span>
          ) : null}
          {status === "wait" ? (
            <span className="text-danger">Aguarde um minuto antes de pedir outro link.</span>
          ) : null}
        </p>
        <FormError message={error} />
      </div>
    </AuthCard>
  );
}
