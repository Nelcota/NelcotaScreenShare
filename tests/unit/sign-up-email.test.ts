import { describe, expect, test } from "vitest";
import { checkSignUp, emailProblem } from "@/features/auth/domain/sign-up";

const INVALID = "Digite um e-mail válido.";
const HOSTILE_EMAIL = `a@${".".repeat(200_000)}@`;
// Generous bound: the old pattern backtracked for many seconds on this input.
const FAST_ENOUGH_MS = 2_000;

describe("e-mail check", () => {
  test("accepts ordinary addresses", () => {
    expect(emailProblem("ana@example.com")).toBeNull();
    expect(emailProblem("  ana.silva+call@mail.example.com.br ")).toBeNull();
  });

  test("rejects addresses without a real domain", () => {
    expect(emailProblem("ana@example")).toBe(INVALID);
    expect(emailProblem("ana@example.c")).toBe(INVALID);
    expect(emailProblem("ana@example..com")).toBe(INVALID);
    expect(emailProblem("ana@.com")).toBe(INVALID);
  });

  test("rejects addresses longer than SMTP delivers", () => {
    const local = "a".repeat(64);
    const domain = `${"b".repeat(185)}.com`;
    expect(emailProblem(`${local}@${domain}`)).toBeNull();
    expect(emailProblem(`${local}@b${domain}`)).toBe(INVALID);
  });

  test("answers a run of dots ending in @ quickly instead of backtracking", () => {
    const started = performance.now();

    const problem = emailProblem(HOSTILE_EMAIL);
    const check = checkSignUp({
      name: "Ana",
      email: HOSTILE_EMAIL,
      password: "a long enough password",
      minPassword: 8,
    });

    expect(problem).toBe(INVALID);
    expect(check).toEqual({ ok: false, field: "email", message: INVALID });
    expect(performance.now() - started).toBeLessThan(FAST_ENOUGH_MS);
  });
});
