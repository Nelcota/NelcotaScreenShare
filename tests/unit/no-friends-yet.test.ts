import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { NoFriendsYet } from "@/features/friends/ui/NoFriendsYet";

/** UX-08: the empty list says to pass the code on, so it shows the code and a copy button. */
test("an empty friends list shows your code with Copiar", () => {
  const html = renderToString(createElement(NoFriendsYet, { code: "NELC-TWCR54" }));
  expect(html).toContain("NELC-TWCR54");
  expect(html).toContain("Copiar");
});

function render(requests: number) {
  const Stub = createRoutesStub([
    {
      path: "/amigos",
      Component: () => createElement(NoFriendsYet, { code: "NELC-TWCR54", requests }),
    },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/amigos"] }));
}

test("with requests waiting, the empty list points to them", () => {
  expect(render(0)).not.toContain("pedido");
  expect(render(1)).toContain("Você tem 1 pedido de amizade.");
  expect(render(2)).toContain("Você tem 2 pedidos de amizade.");
  expect(render(1)).toContain('href="/amigos/pedidos"');
});
