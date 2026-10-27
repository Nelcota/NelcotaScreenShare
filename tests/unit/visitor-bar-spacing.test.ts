import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader, type AppHeaderProps } from "@/components/shell/AppHeader";

/** The bar's own tag, whatever the order of its attributes. */
function barTag(html: string): string {
  return /<nav[^>]*aria-label="Principal"[^>]*>/.exec(html)?.[0] ?? "";
}

function renderBar(
  account: { name: string; image: string | null } | null,
  extra: Partial<AppHeaderProps> = {},
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () =>
        createElement(
          TooltipProvider,
          null,
          createElement(AppHeader, { account, inApp: account !== null, ...extra }),
        ),
    },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

/** The landing bar read uneven: a taller "Criar conta", glued to "Entrar", tight dividers. */
test("the visitor's bar keeps every item the same height and evenly spaced", () => {
  const html = renderBar(null);

  const signUp = /<a[^>]*href="\/cadastro"[^>]*>/.exec(html)?.[0] ?? "";
  expect(signUp).toMatch(/\bh-9\b/);
  expect(signUp).toMatch(/\bml-1\b/);
  expect(barTag(html)).toMatch(/\bgap-1\.5\b/);
  expect(html.match(/<span aria-hidden="true" class="[^"]*\bmx-2\b[^"]*"/g)?.length).toBe(2);
});

/** The panel's sign-in bar has no sign-in links but an action, after its own divider. */
test("a visitor's bar with an action spaces that divider the same way", () => {
  const html = renderBar(null, { showAuthLinks: false, actions: "Painel admin" });

  expect(html.match(/<span aria-hidden="true" class="[^"]*\bmx-2\b[^"]*"/g)?.length).toBe(2);
});

test("the app's own bar keeps its spacing", () => {
  const html = renderBar({ name: "Ana", image: null });

  expect(barTag(html)).not.toMatch(/\bgap-1\.5\b/);
});
