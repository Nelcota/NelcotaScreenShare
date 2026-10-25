import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FriendsColumn } from "@/features/friends/ui/FriendsColumn";

function renderColumn(): string {
  const Stub = createRoutesStub([
    {
      path: "/inicio",
      Component: () =>
        createElement(
          TooltipProvider,
          null,
          createElement(FriendsColumn, {
            tabs: [
              { id: "amigos", label: "Amigos", href: "/inicio" },
              { id: "salas", label: "Salas", href: "/salas" },
              { id: "times", label: "Times", href: "/times" },
            ],
            activeTab: "amigos",
            friends: [],
            extras: { addItems: [], unreadByFriend: {} },
            requests: 0,
            code: "NELC-TWCR54",
            linkPath: "/amigo/x",
            onCollapse: () => {},
          }),
        ),
    },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/inicio"] }));
}

/** The box has its outline; a second one around the active tab looked doubled. */
test("the active column tab stands out by its fill, without an outline of its own", () => {
  const html = renderColumn();

  const active = /<a[^>]*aria-current="page"[^>]*>/.exec(html)?.[0] ?? "";
  expect(active).toContain("aria-[current=page]:bg-surface-3");
  expect(active).not.toMatch(/ring-/);
});
