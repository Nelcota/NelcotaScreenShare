import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { RoomCollection } from "@/components/workspace/RoomCollection";

/** Renders the rooms without Pro and without rooms, yours or a team's. */
function renderWithoutPro(teamId?: string) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () =>
        RoomCollection({
          rooms: [],
          teamId,
          pro: { active: false, roomLimit: 0 },
          canCreate: true,
          enabled: true,
          pending: false,
          onCommand: () => undefined,
        }),
    },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

test("your rooms without Pro say it like Times: title, Só no Pro and the Pro list", () => {
  const html = renderWithoutPro();
  expect(html).toMatch(/<h1[^>]*>Minhas salas<\/h1>/);
  expect(html).toContain("Só no Pro.");
  expect(html).toContain("Entrar na lista do Pro");
  expect(html).not.toContain("Ir para o Início");
});

test("a team's rooms without Pro use the same notice under the team's title", () => {
  const html = renderWithoutPro("team-1");
  expect(html).toMatch(/<h2[^>]*>Salas do time<\/h2>/);
  expect(html).toContain("Só no Pro.");
  expect(html).not.toContain("Ir para o Início");
});
