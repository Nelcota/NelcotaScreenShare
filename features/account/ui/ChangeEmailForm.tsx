import { useId, useState, type FormEvent } from "react";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callAuth } from "@/features/auth/client/auth-call";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import { EMAIL_PATTERN } from "@/features/auth/domain/sign-up";
import { formText } from "@/lib/utils";
import { useCloseRow } from "./settings/ExpandableRow";

/** E-mail change: the link goes to the new address; until confirmed, the old one stays valid. */
export function ChangeEmailForm({ email }: { email: string }) {
  const emailId = useId();
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  // When going back with "Usar outro e-mail", the field keeps what was typed.
  const [draft, setDraft] = useState("");
  const closeRow = useCloseRow();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newEmail = formText(new FormData(event.currentTarget), "email").trim();
    if (!EMAIL_PATTERN.test(newEmail)) return setError("Digite um e-mail válido.");
    if (newEmail.toLowerCase() === email.toLowerCase()) {
      return setError("Digite um e-mail diferente do atual.");
    }
    setPending(true);
    setError(undefined);
    const { error: failure } = await callAuth(() =>
      authClient.changeEmail({
        newEmail,
        callbackURL: "/conta?aviso=email",
      }),
    );
    setPending(false);
    // An e-mail already used by another account also returns 200 (the server does not reveal it);
    // any error here is real (expired session, rate limit, server failure).
    if (failure) return setError(authErrorMessage(failure));
    setDraft(newEmail);
    setSentTo(newEmail);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-3">
        <output className="block text-sm text-ink-muted">
          Se for possível usar <strong className="text-ink">{sentTo}</strong>, enviamos um link para
          confirmar a troca. Até lá, sua conta continua com {email}. Não chegou? Confira o spam.
        </output>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setSentTo(undefined)}
        >
          Usar outro e-mail
        </Button>
      </div>
    );
  }

  return (
    <form
      method="post"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      className="flex max-w-sm flex-col gap-3"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Novo e-mail</Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={draft}
          aria-invalid={error ? true : undefined}
          onChange={() => setError(undefined)}
          className="h-10"
        />
      </div>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Enviar link de confirmação
        </Button>
        {closeRow ? (
          <Button type="button" variant="ghost" onClick={closeRow}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
