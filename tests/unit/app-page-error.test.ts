import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  data,
  Outlet,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import { expect, test } from "vitest";
import routes from "@/app/routes";
import * as pageFrame from "@/app/routes/app/page-frame";

const APP_PAGES = ["inicio", "amigos", "conta", "mensagens/:conversa", "salas", "times/:id"];

/** The app's pages, as the routes config wires them under the column. */
function appChildren() {
  const app = routes.find((entry) => entry.id === "app");
  return app?.children ?? [];
}

test("every app page sits under the frame that catches its errors", () => {
  const [frame, ...others] = appChildren();
  expect(others).toEqual([]);
  expect(frame?.file).toBe("routes/app/page-frame.tsx");
  const paths = (frame?.children ?? []).map((child) => child.path);
  for (const path of APP_PAGES) expect(paths).toContain(path);
});

async function renderPage(loader: () => never) {
  const tree: RouteObject[] = [
    {
      id: "app",
      path: "/",
      Component: () =>
        createElement(
          "div",
          null,
          createElement("nav", null, "Coluna de amigos"),
          createElement("main", null, createElement(Outlet)),
        ),
      children: [
        {
          id: "frame",
          Component: pageFrame.default,
          ErrorBoundary: pageFrame.ErrorBoundary,
          children: [{ id: "page", path: "amigos", loader, Component: () => null }],
        },
      ],
    },
  ];
  const handler = createStaticHandler(tree);
  const context = await handler.query(new Request("http://localhost/amigos"));
  if (context instanceof Response) throw new Error("unexpected redirect");
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToString(createElement(StaticRouterProvider, { router, context, hydrate: false }));
}

test("a page that fails keeps the column and offers to try again", async () => {
  const html = await renderPage(() => {
    throw new Error("boom");
  });
  expect(html).toContain("Coluna de amigos");
  expect(html).toContain("Tentar de novo");
  expect(html).not.toContain("boom");
});

test("a missing page keeps the column and points to the start", async () => {
  const html = await renderPage(() => {
    throw data(null, { status: 404 });
  });
  expect(html).toContain("Coluna de amigos");
  expect(html).toContain("Essa página sumiu.");
  expect(html).toContain('href="/inicio"');
});
