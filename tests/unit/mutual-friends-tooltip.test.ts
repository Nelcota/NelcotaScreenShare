import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, test } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FriendProfilePanel } from "@/features/friends/ui/FriendProfilePanel";

/** Server HTML of a component inside a router and the tooltip provider, as the app has. */
function render(element: ReactElement): string {
  const Stub = createRoutesStub([
    { path: "/", Component: () => createElement(TooltipProvider, null, element) },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

describe("controls in the app's own look", () => {
  test("mutual friends name each photo with the app's tooltip, not the browser's title", () => {
    const profile = {
      id: "a",
      name: "Bia",
      code: "NELC-ABCDEF",
      since: "outubro de 2026",
      mutual: { shown: [{ id: "b", name: "Caio" }], total: 1 },
    };
    const html = render(createElement(FriendProfilePanel, { profile, status: "online" }));
    expect(html).not.toContain('title="Caio"');
  });
});

function profileWithMutual(total: number) {
  return {
    id: "a",
    name: "Bia",
    code: "NELC-ABCDEF",
    since: "outubro de 2026",
    mutual: { shown: total ? [{ id: "b", name: "Caio" }] : [], total },
  };
}

/** UX-10: "Amigos em comum: Nenhum amigo em comum" added a section that said nothing. */
test("the profile shows mutual friends only when there are some", () => {
  expect(
    render(createElement(FriendProfilePanel, { profile: profileWithMutual(0), status: "online" })),
  ).not.toContain("em comum");
  expect(
    render(createElement(FriendProfilePanel, { profile: profileWithMutual(1), status: "online" })),
  ).toContain("1 amigo em comum");
});
