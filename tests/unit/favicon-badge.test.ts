import { afterEach, beforeEach, expect, test, vi } from "vitest";

function browserIcons() {
  const links: Icon[] = [];
  class Icon {
    readonly attributes = new Map<string, string>();
    constructor(public href: string) {}
    getAttribute(name: string) {
      return this.attributes.get(name) ?? null;
    }
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
    hasAttribute(name: string) {
      return this.attributes.has(name);
    }
    removeAttribute(name: string) {
      this.attributes.delete(name);
    }
  }
  const originals = [
    new Icon("https://example.test/favicon.ico"),
    new Icon("https://example.test/icon.png"),
  ];
  links.push(...originals);
  const context = {
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
  };
  vi.stubGlobal("document", {
    querySelectorAll: () => [...links],
    createElement: () => ({
      getContext: () => context,
      toDataURL: () => "data:image/png;base64,badge",
    }),
  });
  vi.stubGlobal(
    "Image",
    class {
      addEventListener(event: string, listener: () => void) {
        if (event === "load") queueMicrotask(listener);
      }
    },
  );
  return { links, originals, context };
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

test("unread changes restore the original icons without trusting modified DOM text", async () => {
  const browser = browserIcons();
  const { setFaviconBadge } = await import("@/features/notifications/client/favicon-badge");
  await setFaviconBadge(3);
  expect(browser.links.map((link) => link.href)).toEqual([
    "data:image/png;base64,badge",
    "data:image/png;base64,badge",
  ]);
  for (const link of browser.links) link.setAttribute("data-original-href", "javascript:alert(1)");
  await setFaviconBadge(7);
  expect(browser.context.fillText).toHaveBeenLastCalledWith("7", 45, 46);
  await setFaviconBadge(0);
  expect(browser.links.map((link) => link.href)).toEqual([
    "https://example.test/favicon.ico",
    "https://example.test/icon.png",
  ]);
  expect(browser.links[0]).toBe(browser.originals[0]);
  expect(browser.links[1]).toBe(browser.originals[1]);
});

test("clearing unread while the image loads keeps the original icons", async () => {
  const browser = browserIcons();
  const { setFaviconBadge } = await import("@/features/notifications/client/favicon-badge");
  const pending = setFaviconBadge(4);
  await setFaviconBadge(0);
  await pending;
  expect(browser.links[0]).toBe(browser.originals[0]);
  expect(browser.links[1]).toBe(browser.originals[1]);
  expect(browser.context.drawImage).not.toHaveBeenCalled();
});

test("restoration never installs an executable URL even if the initial icon was changed", async () => {
  const browser = browserIcons();
  browser.originals[0]!.href = "javascript:alert(1)";
  const { setFaviconBadge } = await import("@/features/notifications/client/favicon-badge");
  await setFaviconBadge(2);
  await setFaviconBadge(0);
  expect(browser.links[0]?.href).toBe("data:image/png;base64,badge");
  expect(browser.links[1]?.href).toBe("https://example.test/icon.png");
});
