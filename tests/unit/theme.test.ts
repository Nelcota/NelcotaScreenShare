import { runInNewContext } from "node:vm";
import { afterEach, expect, test, vi } from "vitest";
import {
  currentTheme,
  subscribeTheme,
  switchTheme,
  THEME_COLOR,
  THEME_INIT_SCRIPT,
} from "@/lib/theme";

afterEach(() => vi.unstubAllGlobals());

test.each([
  { stored: "dark", systemLight: true, expected: "dark" },
  { stored: "light", systemLight: false, expected: "light" },
  { stored: null, systemLight: true, expected: "light" },
  { stored: "invalid", systemLight: false, expected: "dark" },
  { stored: '</script><script>alert("theme")</script>', systemLight: true, expected: "light" },
])(
  "initial theme honors saved choices and otherwise uses the system before paint",
  ({ stored, systemLight, expected }) => {
    const root = { dataset: {} as { theme?: string } };
    const meta = { content: "" };
    runInNewContext(THEME_INIT_SCRIPT, {
      localStorage: { getItem: () => stored },
      matchMedia: () => ({ matches: systemLight }),
      document: { documentElement: root, querySelector: () => meta },
    });
    expect(root.dataset.theme).toBe(expected);
    expect(meta.content).toBe(THEME_COLOR[expected as keyof typeof THEME_COLOR]);
  },
);

test("blocked storage and absent browser-color metadata do not prevent initial rendering", () => {
  const root = { dataset: {} as { theme?: string } };
  expect(() => {
    runInNewContext(THEME_INIT_SCRIPT, {
      localStorage: {
        getItem: () => {
          throw new Error("Storage blocked");
        },
      },
      matchMedia: () => ({ matches: true }),
      document: { documentElement: root, querySelector: () => null },
    });
  }).not.toThrow();
  expect(root.dataset.theme).toBe("light");
});

function browserEnvironment(reducedMotion: boolean) {
  const root = { dataset: { theme: "light" } };
  const meta = { setAttribute: vi.fn() };
  const transition = vi.fn((apply: () => void) => apply());
  const storage = { setItem: vi.fn() };
  vi.stubGlobal("document", {
    documentElement: root,
    querySelector: () => meta,
    startViewTransition: transition,
  });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reducedMotion }) });
  vi.stubGlobal("localStorage", storage);
  return { root, meta, transition, storage };
}

test("reduced motion applies the new theme immediately and saves the choice", () => {
  const browser = browserEnvironment(true);
  switchTheme("dark");
  expect(currentTheme()).toBe("dark");
  expect(browser.transition).not.toHaveBeenCalled();
  expect(browser.meta.setAttribute).toHaveBeenCalledWith("content", THEME_COLOR.dark);
  expect(browser.storage.setItem).toHaveBeenCalledWith("nelcota:tema", "dark");
});

test("supported transitions still update the theme when storage refuses persistence", () => {
  const browser = browserEnvironment(false);
  browser.storage.setItem.mockImplementation(() => {
    throw new Error("Storage blocked");
  });
  expect(() => switchTheme("dark")).not.toThrow();
  expect(browser.transition).toHaveBeenCalledTimes(1);
  expect(currentTheme()).toBe("dark");
});

test("theme subscriptions observe the theme attribute and disconnect after unmount", () => {
  const browser = browserEnvironment(false);
  const observer = { observe: vi.fn(), disconnect: vi.fn() };
  const constructor = vi.fn(function () {
    return observer;
  });
  vi.stubGlobal("MutationObserver", constructor);
  const changed = vi.fn();
  const unsubscribe = subscribeTheme(changed);
  expect(constructor).toHaveBeenCalledWith(changed);
  expect(observer.observe).toHaveBeenCalledWith(browser.root, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  unsubscribe();
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
});
