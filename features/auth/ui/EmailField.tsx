import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { nodMascot, setMascotDoubt } from "@/features/mascot/client/events";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/Field";
import { suggestEmail } from "@/features/auth/domain/email-suggest";
import { EMAIL_PATTERN } from "@/features/auth/domain/sign-up";

/** E-mail typed in one tab carries over to the other (only in this browser tab). */
const REMEMBER_KEY = "nelcota:acesso-email";

function remember(value: string) {
  try {
    sessionStorage.setItem(REMEMBER_KEY, value);
  } catch {
    // No sessionStorage: carry on without remembering.
  }
}

export function forgetTypedEmail() {
  try {
    sessionStorage.removeItem(REMEMBER_KEY);
  } catch {
    // Storage blocked: nothing to forget.
  }
}

/**
 * E-mail field of the access screens: remembers what was typed when switching
 * tabs, suggests the right domain ("gmial.com" → "gmail.com") and notifies the
 * mascot (suspicious on error, approving when it becomes correct).
 */
export function EmailField({
  id,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  autoComplete: "username" | "email";
  invalid?: boolean;
  describedBy?: string | undefined;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [suggestion, setSuggestion] = useState<string>();

  // Before paint: the field already shows filled in, without flashing empty.
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input || input.value) return;
    try {
      const saved = sessionStorage.getItem(REMEMBER_KEY);
      if (saved) input.value = saved;
    } catch {
      // No sessionStorage (strict private mode): it just does not remember.
    }
  }, []);

  useEffect(() => () => setMascotDoubt(false), []);

  function check(value: string) {
    const next = suggestEmail(value);
    setSuggestion(next);
    setMascotDoubt(next !== undefined);
    if (!next && EMAIL_PATTERN.test(value)) nodMascot();
  }

  function accept() {
    if (!ref.current || !suggestion) return;
    ref.current.value = suggestion;
    remember(suggestion);
    setSuggestion(undefined);
    setMascotDoubt(false);
    nodMascot();
    ref.current.focus();
  }

  return (
    <Field
      id={id}
      label="E-mail"
      footer={
        suggestion ? (
          <p id={hintId} className="text-sm text-ink-muted">
            Você quis dizer{" "}
            <button
              type="button"
              onClick={accept}
              className="font-medium text-brand-soft underline-offset-2 hover:underline"
            >
              {suggestion}
            </button>
            ?
          </p>
        ) : null
      }
    >
      <Input
        ref={ref}
        name="email"
        type="email"
        inputMode="email"
        autoComplete={autoComplete}
        spellCheck={false}
        required
        className="h-11"
        aria-invalid={invalid || undefined}
        aria-describedby={
          [describedBy, suggestion ? hintId : undefined].filter(Boolean).join(" ") || undefined
        }
        onChange={(event) => {
          remember(event.target.value);
          if (suggestion) {
            setSuggestion(undefined);
            setMascotDoubt(false);
          }
        }}
        onBlur={(event) => check(event.target.value.trim())}
      />
    </Field>
  );
}
