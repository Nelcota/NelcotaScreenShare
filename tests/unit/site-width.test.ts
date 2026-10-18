import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { AppHeader } from "@/components/shell/AppHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

/** Builds the element while the route renders, so components with router hooks work. */
function render(element: () => React.ReactElement) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => createElement(TooltipProvider, null, element()) },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

/** Going from the app (1440 px) to another page made the top bar shrink to 1024 px. */
test("the top bar has the app's width on every page, signed in or not", () => {
  for (const account of [null, { name: "Ana", image: null }]) {
    const html = render(() => createElement(AppHeader, { account }));
    expect(html).toContain("max-w-[90rem]");
    expect(html).not.toContain("max-w-5xl");
  }
});

test("the footer spans the same width as the top bar", () => {
  expect(render(() => createElement(SiteFooter))).toContain("site-column");
});

test("a team invitation outside the app lines up with the top bar", () => {
  const html = render(() =>
    WorkspaceShell({
      account: { name: "Ana", image: null },
      title: "Convite de time",
      description: "Entre no time.",
      children: createElement("p", null, "Convite"),
    }),
  );
  expect(html).toContain("max-w-[93rem]");
  expect(html).not.toContain("max-w-5xl");
});
