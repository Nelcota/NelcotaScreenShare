import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { SmartBar } from "@/features/home/ui/SmartBar";

function render(invalidCode: boolean) {
  const bar = createElement(SmartBar, {
    invalidCode,
    pending: false,
    onNavigate: () => {},
    onCreateRoom: () => {},
    mascot: null,
  });
  const Stub = createRoutesStub([{ path: "/", Component: () => bar }]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

/** A room code that does not exist is not an invite: the message says what happened. */
test("an unknown room code says the room does not exist", () => {
  expect(render(true)).toContain("Esse código de sala não existe. Confira o link.");
  expect(render(true)).not.toContain("convite");
  expect(render(false)).not.toContain("não existe");
});
