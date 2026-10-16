import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { createGroupItem } from "@/app/routes/app/column-parts";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FriendsColumn } from "@/features/friends/ui/FriendsColumn";

/** UX-09: "Criar grupo" and "Adicionar amigo" were two round icons that looked alike. */
test("the friends column has one + for adding, not two look-alike icons", () => {
  const Stub = createRoutesStub([
    {
      path: "/amigos",
      Component: () =>
        createElement(
          TooltipProvider,
          null,
          createElement(FriendsColumn, {
            tabs: [],
            activeTab: "amigos",
            friends: [],
            extras: { addItems: [createGroupItem([])], unreadByFriend: {} },
            requests: 0,
            code: "NELC-TWCR54",
            linkPath: "/amigo/x",
            onCollapse: () => {},
          }),
        ),
    },
  ]);
  const html = renderToString(createElement(Stub, { initialEntries: ["/amigos"] }));
  expect(html).toContain('aria-label="Adicionar"');
  expect(html).not.toContain('aria-label="Adicionar amigo"');
  expect(html).not.toContain('aria-label="Criar grupo"');
});
