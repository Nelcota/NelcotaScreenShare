import { displayNameSchema } from "@/features/room/domain/participant-label";
import { passwordTooShortMessage } from "./password-rules";

/**
 * E-mail that looks valid (the server does the real check). Domain labels exclude the
 * dot so a run of dots has one split, which keeps the check linear on hostile input.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/;

/** Longest address SMTP delivers (RFC 5321 path limit minus the angle brackets). */
const MAX_EMAIL_LENGTH = 254;

const INVALID_EMAIL = "Digite um e-mail válido.";

function looksLikeEmail(email: string): boolean {
  if (email.length > MAX_EMAIL_LENGTH) return false;
  return EMAIL_PATTERN.test(email);
}

/**
 * What is wrong with a typed e-mail, or null. Checked before calling the server, so a
 * blank or half-typed address never spends the attempt limit.
 */
export function emailProblem(email: string): string | null {
  return looksLikeEmail(email.trim()) ? null : INVALID_EMAIL;
}

export type SignUpCheck =
  | { ok: true; name: string; email: string }
  | { ok: false; field: "name" | "email" | "password"; message: string };

/** Checks the sign-up before submitting, in the order of the screen's fields. */
export function checkSignUp(input: {
  name: string;
  email: string;
  password: string;
  minPassword: number;
}): SignUpCheck {
  const name = displayNameSchema.safeParse(input.name);
  if (!name.success) {
    return {
      ok: false,
      field: "name",
      message: name.error.issues[0]?.message ?? "Confira seu nome.",
    };
  }
  const email = input.email.trim();
  if (!looksLikeEmail(email)) return { ok: false, field: "email", message: INVALID_EMAIL };
  if (input.password.length < input.minPassword) {
    return {
      ok: false,
      field: "password",
      message: passwordTooShortMessage(input.minPassword),
    };
  }
  return { ok: true, name: name.data, email };
}
