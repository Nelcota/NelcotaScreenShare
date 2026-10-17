import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import FriendRequestsPage from "@/app/routes/app/friend-requests";
import { TooltipProvider } from "@/components/ui/tooltip";

const gil = { id: "g", name: "Gil", status: "offline" };

function render(data: Record<string, unknown>) {
  const Stub = createRoutesStub([
    {
      id: "requests",
      path: "/amigos/pedidos",
      Component: () => createElement(TooltipProvider, null, createElement(FriendRequestsPage)),
      loader: () => data,
    },
  ]);
  return renderToString(
    createElement(Stub, {
      initialEntries: ["/amigos/pedidos"],
      hydrationData: { loaderData: { requests: data } },
    }),
  );
}

/** With no requests, a blocked person used to be the only thing on the page. */
test("no requests reads as empty, even with someone blocked", () => {
  const html = render({ received: [], sent: [], blocked: [gil], invite: null });
  expect(html).toContain("Nenhum pedido agora.");
  expect(html).not.toContain("Bloqueados");
  expect(html).not.toContain("Gil");
});

test("received requests are listed and the empty line goes away", () => {
  const html = render({ received: [{ ...gil, name: "Eva" }], sent: [], blocked: [], invite: null });
  expect(html).toContain("Eva");
  expect(html).not.toContain("Nenhum pedido agora.");
});
