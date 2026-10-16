import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createStoredValue } from "@/lib/stored-value";

const telemetry = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/lib/telemetry.client", () => ({ logBrowserWarning: telemetry.warning }));

function denied(): never {
  throw new DOMException("Denied", "SecurityError");
}

/** A page with `localStorage`; `refuse` makes every storage call throw, as a private window can. */
function stubPage({ refuse = false } = {}) {
  const items = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (refuse ? denied() : (items.get(key) ?? null)),
    setItem: (key: string, value: string) => (refuse ? denied() : void items.set(key, value)),
    removeItem: (key: string) => (refuse ? denied() : void items.delete(key)),
  };
  const events = new EventTarget();
  vi.stubGlobal("window", {
    localStorage,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  });
  return items;
}

function onOff(changeEvent?: string) {
  return createStoredValue<boolean>({
    key: "nelcota-test-flag",
    fallback: false,
    parse: (raw) => (raw === "1" ? true : raw === "0" ? false : undefined),
    serialize: (on) => (on ? "1" : "0"),
    changeEvent,
    warning: "Could not access the test flag",
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

test("reads and writes the same key and text format as before", () => {
  const items = stubPage();
  items.set("nelcota-test-flag", "1");
  const flag = onOff();
  expect(flag.read()).toBe(true);
  flag.write(false);
  expect(items.get("nelcota-test-flag")).toBe("0");
  expect(flag.read()).toBe(false);
});

test("nothing or an invalid text reads as the fallback", () => {
  const items = stubPage();
  const flag = onOff();
  expect(flag.read()).toBe(false);
  items.set("nelcota-test-flag", "talvez");
  expect(flag.read()).toBe(false);
});

test("the same stored text gives the same object", () => {
  const items = stubPage();
  items.set("nelcota-test-list", '["a"]');
  const list = createStoredValue<string[]>({
    key: "nelcota-test-list",
    fallback: [],
    parse: (raw) => JSON.parse(raw) as string[],
    serialize: (value) => JSON.stringify(value),
    warning: "Could not access the test list",
  });
  expect(list.read()).toBe(list.read());
});

test("a write tells this page's subscribers through the change event", () => {
  stubPage();
  const flag = onOff("nelcota-test-flag-change");
  const changed = vi.fn();
  const stop = flag.subscribe(changed);
  flag.write(true);
  expect(changed).toHaveBeenCalledOnce();
  stop();
  flag.write(false);
  expect(changed).toHaveBeenCalledOnce();
});

test("clear forgets the value and goes back to the fallback", () => {
  const items = stubPage();
  const flag = onOff();
  flag.write(true);
  flag.clear();
  expect(items.has("nelcota-test-flag")).toBe(false);
  expect(flag.read()).toBe(false);
});

test("refused storage keeps the value in memory and warns once", () => {
  stubPage({ refuse: true });
  const flag = onOff();
  expect(flag.read()).toBe(false);
  flag.write(true);
  expect(flag.read()).toBe(true);
  flag.write(false);
  expect(telemetry.warning).toHaveBeenCalledOnce();
});

test("without a window (SSR) the fallback is read and writes stay in memory", () => {
  const flag = onOff();
  expect(flag.read()).toBe(false);
  flag.write(true);
  expect(flag.read()).toBe(true);
});
