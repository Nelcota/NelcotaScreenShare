import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { BlockedList } from "@/features/friends/ui/BlockedList";

function render(people: { id: string; name: string }[]) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => createElement(BlockedList, { people }) },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

/** Configurações had no way to see or undo a block. */
test("lists the people you blocked, each with Desbloquear", () => {
  const html = render([
    { id: "1", name: "Bia Souza" },
    { id: "2", name: "Caio Lima" },
  ]);
  expect(html).toContain("Bia Souza");
  expect(html).toContain("Caio Lima");
  expect(html.match(/Desbloquear/g)).toHaveLength(2);
});

test("says so when nobody is blocked", () => {
  expect(render([])).toContain("Ninguém bloqueado.");
});
