import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { AppEmptyState } from "@/app/routes/app/empty-state";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FriendGroups } from "@/features/friends/ui/FriendGroups";
import { ColumnGroups } from "@/features/messages/ui/ColumnGroups";

function render(element: React.ReactElement) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => createElement(TooltipProvider, null, element) },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

/** A1: /inicio had no h1 at all. */
test("the empty middle of the app has an h1 for screen readers", () => {
  const html = render(createElement(AppEmptyState, { title: "Início" }));
  expect(html).toMatch(/<h1 class="sr-only"[^>]*>Início<\/h1>/);
});

/** #307: a first visit saw only the small bar and did not know what to do. */
test("the empty middle says what to do, without a second heading", () => {
  const html = render(createElement(AppEmptyState, { title: "Início" }));
  expect(html).toContain("Crie uma sala e chame seus amigos");
  expect(html.match(/<h[1-6]/g)).toHaveLength(1);
});

/** A1: the column comes first in the page, so its headings came before the page's h1. */
test("the column's groups name their lists without headings", () => {
  const friend = { id: "1", name: "Bia", status: "online" } as const;
  const html = render(
    createElement(FriendGroups, {
      friends: [friend] as never,
      before: createElement(ColumnGroups, {
        groups: [{ id: "g", kind: "group", name: "Grupo", unread: 0, others: [] }] as never,
      }),
    }),
  );
  expect(html).not.toMatch(/<h[1-6]/);
  expect(html).toContain("aria-labelledby");
});
