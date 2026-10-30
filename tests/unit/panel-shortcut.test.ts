import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader, type AppHeaderProps } from "@/components/shell/AppHeader";

function renderBar(props: Pick<AppHeaderProps, "account" | "inApp">): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => createElement(TooltipProvider, null, createElement(AppHeader, props)),
    },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

const SHORTCUT = 'aria-label="Abrir o painel admin"';

/** Only the call had a way to the panel; the rest of the app went through Configurações. */
test("someone on the team gets the panel's shortcut in the app's top bar", () => {
  const html = renderBar({ account: { name: "Ana", image: null, panel: true }, inApp: true });

  expect(html).toContain(SHORTCUT);
  expect(html).toContain('href="/admin"');
});

test("nobody else sees it: an account outside the team, nor a visitor", () => {
  const outside = renderBar({ account: { name: "Bia", image: null, panel: false }, inApp: true });
  const visitor = renderBar({ account: null, inApp: false });

  expect(outside).not.toContain(SHORTCUT);
  expect(visitor).not.toContain(SHORTCUT);
});
