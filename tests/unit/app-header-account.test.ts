import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import { AppHeader } from "@/components/shell/AppHeader";
import { StatusStrip } from "@/features/friends/ui/StatusStrip";
import { TooltipProvider } from "@/components/ui/tooltip";

const ACCOUNT = { name: "Ana Souza", image: null };

/** Builds the element while the route renders, so components with router hooks work. */
function render(element: () => React.ReactElement, path = "/") {
  const Stub = createRoutesStub([
    { path: "*", Component: () => createElement(TooltipProvider, null, element()) },
  ]);
  return renderToString(createElement(Stub, { initialEntries: [path] }));
}

const strip = () => createElement(StatusStrip, { account: ACCOUNT, status: "online" });
const rail = () =>
  createElement(StatusStrip, { account: ACCOUNT, status: "online", compact: true });

/** The photo's menu trigger: the bar's only popover button. */
function accountTrigger(html: string) {
  return html.match(/<button[^>]*aria-haspopup="dialog"[^>]*>/)?.[0] ?? "";
}

/** The bar's own "Novidades" link (outside the app it lives in the photo's menu). */
function newsLink(html: string) {
  return html.match(/<a[^>]*>Novidades<\/a>/)?.[0] ?? "";
}

test("inside the app the bar shows Novidades, and the photo's menu only on phones", () => {
  const html = render(() => createElement(AppHeader, { account: ACCOUNT, inApp: true }));
  expect(newsLink(html)).toContain('href="/novidades"');
  expect(newsLink(html)).toContain("max-sm:hidden");
  expect(accountTrigger(html)).toContain(" sm:hidden");
});

test("outside the app the photo's menu stays on every size", () => {
  const html = render(() => createElement(AppHeader, { account: ACCOUNT }));
  expect(newsLink(html)).toBe("");
  expect(accountTrigger(html)).not.toBe("");
  expect(accountTrigger(html)).not.toContain(" sm:hidden");
});

test("the column's gear leads back to the room it was opened from", () => {
  expect(render(strip, "/sala/abc-defg-hij")).toContain(
    `href="/conta?voltar=${encodeURIComponent("/sala/abc-defg-hij")}"`,
  );
  expect(render(strip, "/inicio")).toContain('href="/conta"');
});

/** The collapsed column had no gear, and the app bar no longer has the account menu. */
test("the collapsed column still leads to the settings", () => {
  expect(render(rail, "/inicio")).toContain('href="/conta"');
});
