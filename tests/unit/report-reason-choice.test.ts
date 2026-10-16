import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, test } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReasonChoice } from "@/features/reports/ui/ReasonChoice";

/** Server HTML of a component inside a router and the tooltip provider, as the app has. */
function render(element: ReactElement): string {
  const Stub = createRoutesStub([
    { path: "/", Component: () => createElement(TooltipProvider, null, element) },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

describe("controls in the app's own look", () => {
  test("the report reasons are the app's choice rows, not bare radios", () => {
    const html = render(createElement(ReasonChoice, { value: null, onChange: () => {} }));
    expect(html).toContain('class="sr-only"');
    expect(html).toContain("Assédio");
  });
});
