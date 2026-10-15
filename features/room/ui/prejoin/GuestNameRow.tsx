import { UserRound } from "lucide-react";
import { useId, type RefObject } from "react";
import { Link } from "react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Name a guest (no account) shows in the room, with the way in for whoever has an account. */
export function GuestNameRow({
  inputRef,
  name,
  error,
  signInHref,
  onChange,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  name: string;
  error: string | undefined;
  /** Sign-in page that comes back to this room. */
  signInHref: string;
  onChange: (name: string) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  return (
    <div className="flex flex-col gap-2 p-4">
      <Label htmlFor={inputId} className="inline-flex items-center gap-1.5">
        <UserRound className="size-3.5 text-ink-subtle" aria-hidden="true" />
        Seu nome na sala
      </Label>
      <Input
        ref={inputRef}
        id={inputId}
        name="guestName"
        value={name}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="name"
        maxLength={32}
        placeholder="Como vão te ver na sala"
        className="h-12 rounded-full px-5"
        aria-invalid={error !== undefined || undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-ink-muted">
        Você entra como convidado.{" "}
        <Link
          viewTransition
          to={signInHref}
          className="font-medium text-brand-soft underline-offset-4 hover:underline"
        >
          Já tenho conta
        </Link>
      </p>
    </div>
  );
}
