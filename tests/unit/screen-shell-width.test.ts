import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScreenShell } from "@/features/room/ui/RoomShell";

function render(column: string | null) {
  // ScreenShell has no hooks: called directly, it takes its children as a plain argument.
  const shell = () =>
    ScreenShell({
      column: column ? createElement("aside", null, column) : null,
      account: { name: "Ana", image: null },
      children: createElement("p", null, "Você saiu da chamada"),
    });
  const Stub = createRoutesStub([
    { path: "/", Component: () => createElement(TooltipProvider, null, shell()) },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

/** Leaving a call jumped from 1440 px (the app) to 1024 px (the room's screens). */
test("signed in, the room's screens are as wide as the app", () => {
  const html = render("Amigos");
  expect(html).toContain("max-w-[93rem]");
  expect(html).toContain("max-w-[90rem]");
  expect(html).not.toContain("max-w-5xl");
});

test("a guest gets the same bar, over a centered page", () => {
  const html = render(null);
  expect(html).toContain("max-w-[90rem]");
  expect(html).not.toContain("max-w-5xl");
});
