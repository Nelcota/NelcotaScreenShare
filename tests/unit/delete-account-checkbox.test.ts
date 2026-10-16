import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, test } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DeleteAccountForm } from "@/features/account/ui/DeleteAccountForm";

/** Server HTML of a component inside a router and the tooltip provider, as the app has. */
function render(element: ReactElement): string {
  const Stub = createRoutesStub([
    { path: "/", Component: () => createElement(TooltipProvider, null, element) },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

describe("controls in the app's own look", () => {
  test("deleting the account offers the teams option with the app's checkbox", () => {
    const html = render(createElement(DeleteAccountForm, { ownedTeamCount: 1 }));
    expect(html).toContain('data-slot="checkbox"');
  });
});
