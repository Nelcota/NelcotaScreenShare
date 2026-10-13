import { Lock } from "lucide-react";
import { useId, type RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Room password (only when the server requires it and there is no invite). */
export function PasswordField({
  inputRef,
  error,
  onChange,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  error: string | undefined;
  onChange: () => void;
}) {
  const passwordId = useId();
  return (
    <div
      data-anim="row"
      data-invalid={error !== undefined || undefined}
      className="flex w-full flex-col gap-2"
    >
      <Label htmlFor={passwordId} className="inline-flex items-center gap-1.5">
        <Lock className="size-3.5 text-ink-subtle" aria-hidden="true" />
        Senha da sala
      </Label>
      <Input
        ref={inputRef}
        id={passwordId}
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={128}
        className="h-12 rounded-full px-5"
        aria-invalid={error !== undefined || undefined}
        aria-describedby={error ? `${passwordId}-error` : undefined}
        onChange={onChange}
      />
      {error ? (
        <p id={`${passwordId}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
