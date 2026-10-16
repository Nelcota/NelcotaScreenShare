import type { ShouldRevalidateFunctionArgs } from "react-router";
import { expect, test } from "vitest";
import { skipClientOnlyChanges } from "@/app/revalidation";

function args(current: string, next: string, formMethod?: "POST") {
  return {
    currentUrl: new URL(current, "http://localhost"),
    nextUrl: new URL(next, "http://localhost"),
    formMethod,
    defaultShouldRevalidate: true,
  } as ShouldRevalidateFunctionArgs;
}

/** PF1: the room filter and ?atendeu ran every loader again, root and friends column included. */
test("changing only the room filter or dropping ?atendeu reloads nothing", () => {
  expect(skipClientOnlyChanges(args("/salas", "/salas?filtro=favoritas"))).toBe(false);
  expect(skipClientOnlyChanges(args("/salas?filtro=favoritas", "/salas"))).toBe(false);
  expect(skipClientOnlyChanges(args("/sala/abc?atendeu=1", "/sala/abc"))).toBe(false);
});

test("a new page, another parameter, a form or a plain revalidation still reload", () => {
  expect(skipClientOnlyChanges(args("/salas", "/times?filtro=favoritas"))).toBe(true);
  expect(skipClientOnlyChanges(args("/salas/1", "/salas/1?pagina=2"))).toBe(true);
  expect(skipClientOnlyChanges(args("/salas", "/salas?filtro=favoritas", "POST"))).toBe(true);
  expect(skipClientOnlyChanges(args("/salas", "/salas"))).toBe(true);
});
