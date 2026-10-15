import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { columnTabs } from "@/app/routes/app/column-parts";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FriendsColumn } from "@/features/friends/ui/FriendsColumn";

/** UX-09: Salas and Times were only an icon, named in a hint that touch never shows. */
test("every column tab shows its name, not only the open one", () => {
  const Stub = createRoutesStub([
    {
      path: "/salas",
      Component: () =>
        createElement(
          TooltipProvider,
          null,
          createElement(
            FriendsColumn,
            {
              tabs: columnTabs({ requests: 0, unread: 0 }),
              activeTab: "salas",
              friends: [],
              extras: { actions: null, groups: null, unreadByFriend: {} },
              requests: 0,
              code: "NELC-TWCR54",
              linkPath: "/amigo/x",
              onCollapse: () => {},
            },
            createElement("p", null, "lista"),
          ),
        ),
    },
  ]);
  const html = renderToString(createElement(Stub, { initialEntries: ["/salas"] }));
  for (const label of ["Amigos", "Salas", "Times"]) {
    expect(html).toMatch(new RegExp(`<span>${label}</span>`));
  }
});
