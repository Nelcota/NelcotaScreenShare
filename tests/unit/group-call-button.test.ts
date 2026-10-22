import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { GroupCallButton } from "@/features/ringing/ui/CallButton";

const groupCall = () => GroupCallButton({ conversationId: "grupo", name: "Bia e Caio" });

/**
 * On a phone the header shrinks the button to its icon, but the label stayed visible and ran
 * over the "…" menu next to it.
 */
test("the group call label hides on phones and stays for screen readers", () => {
  const Stub = createRoutesStub([{ path: "/", Component: groupCall }]);
  const html = renderToString(createElement(Stub, { initialEntries: ["/"] }));

  expect(html).toMatch(/<span class="max-sm:sr-only">Chamar o grupo<\/span>/);
});
