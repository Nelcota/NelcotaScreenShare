import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { NoFriendsYet } from "@/features/friends/ui/NoFriendsYet";

/** UX-08: the empty list says to pass the code on, so it shows the code and a copy button. */
test("an empty friends list shows your code with Copiar", () => {
  const html = renderToString(createElement(NoFriendsYet, { code: "NELC-TWCR54" }));
  expect(html).toContain("NELC-TWCR54");
  expect(html).toContain("Copiar");
});
