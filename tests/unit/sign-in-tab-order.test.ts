import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { SignInForm } from "@/features/auth/ui/SignInForm";

/** Tab from the e-mail goes to the password: the "Esqueci a senha" link comes after it. */
test("the password field comes before the forgot-password link in the tab order", () => {
  const Stub = createRoutesStub([
    {
      path: "/entrar",
      Component: () => createElement(SignInForm, { returnTo: "/inicio", context: { kind: "app" } }),
    },
  ]);
  const html = renderToString(createElement(Stub, { initialEntries: ["/entrar"] }));
  const password = html.indexOf('name="password"');
  const forgot = html.indexOf("Esqueci a senha");
  expect(password).toBeGreaterThan(0);
  expect(forgot).toBeGreaterThan(password);
});
