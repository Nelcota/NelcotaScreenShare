import { Check, Circle, UserPlus } from "lucide-react";
import { Link, useNavigate, useRevalidator } from "react-router";

import { useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { AccessTabs } from "./AccessTabs";
import { EmailField, forgetTypedEmail } from "./EmailField";
import { AuthCard } from "./AuthCard";
import { useFormError } from "./use-form-error";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { celebrateMascot, upsetMascot } from "@/features/mascot/client/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccessContext } from "@/features/auth/domain/access-context";
import { callAuth } from "@/features/auth/client/auth-call";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import {
  PASSWORD_LIMITS,
  passwordStrength,
  STRENGTH_LABELS,
} from "@/features/auth/domain/password-rules";
import { cn, formText } from "@/lib/utils";
import { checkSignUp } from "@/features/auth/domain/sign-up";

const { min: MIN_PASSWORD, max: MAX_PASSWORD } = PASSWORD_LIMITS.user;

const STRENGTH_COLORS = ["bg-line", "bg-danger", "bg-warning", "bg-success"] as const;

/** Password requirement and strength, live (strength only guides; the server requires the length). */
function PasswordGuide({
  id,
  password,
  personal,
}: {
  id: string;
  password: string;
  personal: string[];
}) {
  const longEnough = password.length >= MIN_PASSWORD;
  const strength = passwordStrength(password, { min: MIN_PASSWORD, personal });
  return (
    <div id={id} className="flex flex-col gap-2 text-sm">
      <p className={cn("flex items-center gap-2", longEnough ? "text-success" : "text-ink-muted")}>
        {longEnough ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Circle className="size-4" aria-hidden="true" />
        )}
        Pelo menos {MIN_PASSWORD} caracteres
        <span className="sr-only">{longEnough ? "(ok)" : "(ainda não)"}</span>
      </p>
      {password ? (
        <div className="flex items-center gap-3">
          <span className="grid flex-1 grid-cols-3 gap-1" aria-hidden="true">
            {[1, 2, 3].map((level) => (
              <span
                key={level}
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  strength >= level ? STRENGTH_COLORS[strength] : "bg-line",
                )}
              />
            ))}
          </span>
          <span className="w-20 text-right text-xs text-ink-muted" aria-live="polite">
            {STRENGTH_LABELS[strength]}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function signUpDescription(toRoom: boolean, verificationRequired: boolean): string {
  if (!toRoom) return "Para criar salas e compartilhar a tela.";
  if (verificationRequired) return "Depois de confirmar o e-mail, você entra na sala.";
  return "Assim que criar a conta, você entra na sala.";
}

export function SignUpForm({
  returnTo,
  context,
  verificationRequired,
}: {
  returnTo: string;
  context: AccessContext;
  /** With confirmation off, sign-up signs into the account right away. */
  verificationRequired: boolean;
}) {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const ids = { name: useId(), email: useId(), password: useId(), guide: useId(), error: useId() };
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useFormError();
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [personal, setPersonal] = useState<string[]>([]);
  const back = encodeURIComponent(returnTo);

  function fail(message: string, field?: HTMLElement | null) {
    setError(message);
    upsetMascot("grumpy", field ?? undefined);
    field?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const check = checkSignUp({
      name: formText(data, "name"),
      email: formText(data, "email"),
      password,
      minPassword: MIN_PASSWORD,
    });
    if (!check.ok) {
      const fields = {
        name: nameRef.current,
        email: form.querySelector<HTMLElement>("[name=email]"),
        password: passwordRef.current,
      };
      return fail(check.message, fields[check.field]);
    }
    const { name, email } = check;

    setPending(true);
    setError(undefined);
    const { error: failure } = await callAuth(() =>
      authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: returnTo,
      }),
    );
    // With confirmation, an already registered e-mail responds the same (the owner is notified by e-mail).
    const genericDuplicate =
      verificationRequired && (failure?.status === 422 || failure?.code === "USER_ALREADY_EXISTS");
    if (failure && !genericDuplicate) {
      setPending(false);
      setError(authErrorMessage(failure));
      upsetMascot(failure.status && failure.status < 500 ? "grumpy" : "worried");
      return;
    }
    forgetTypedEmail();
    celebrateMascot();
    if (verificationRequired) {
      void navigate(`/verificar-email?email=${encodeURIComponent(email)}&voltar=${back}`, {
        replace: true,
        viewTransition: true,
      });
      return;
    }
    // Without confirmation, Better Auth already opened the session: go where the person was heading.
    void navigate(returnTo, { replace: true, viewTransition: true });
    void revalidator.revalidate();
  }

  return (
    <AuthCard
      icon={UserPlus}
      title="Crie sua conta"
      description={signUpDescription(context.kind === "room", verificationRequired)}
      top={<AccessTabs current="cadastro" returnTo={returnTo} />}
    >
      <form
        method="post"
        onSubmit={(event) => void handleSubmit(event)}
        onChange={(event) => setPersonal(personalWords(event.currentTarget))}
        noValidate
        className="flex flex-col gap-4"
      >
        <NameField id={ids.name} ref={nameRef} />
        <EmailField id={ids.email} autoComplete="email" />
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.password}>Senha</Label>
          <PasswordInput
            ref={passwordRef}
            id={ids.password}
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            maxLength={MAX_PASSWORD}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={ids.guide}
          />
          <PasswordGuide id={ids.guide} password={password} personal={personal} />
        </div>
        <FormError id={ids.error} message={error} />
        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
          Criar conta
        </Button>
        <PrivacyConsent />
      </form>
    </AuthCard>
  );
}

/** Name and e-mail count in the strength score: a password containing them is "Fraca". */
function personalWords(form: HTMLFormElement): string[] {
  const value = (field: string) =>
    form.querySelector<HTMLInputElement>(`[name=${field}]`)?.value ?? "";
  return [value("name"), value("email").split("@")[0] ?? ""];
}

function NameField({ id, ref }: { id: string; ref: RefObject<HTMLInputElement | null> }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Seu nome</Label>
      <Input
        ref={ref}
        id={id}
        name="name"
        autoComplete="nickname"
        placeholder="Como vão te ver na sala"
        required
        maxLength={32}
        className="h-11"
      />
    </div>
  );
}

function PrivacyConsent() {
  return (
    <p className="text-center text-xs text-ink-subtle">
      Ao criar a conta, você concorda com o{" "}
      <Link
        viewTransition
        to="/privacidade"
        target="_blank"
        className="font-medium text-brand-soft hover:underline"
      >
        aviso de privacidade
      </Link>
      .
    </p>
  );
}
