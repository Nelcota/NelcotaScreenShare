import { logBrowserWarning } from "@/lib/telemetry.client";

/** One preference kept in this browser's `localStorage`. */
export interface StoredValue<T> {
  /** The saved value; the same object while the stored text does not change. */
  read: () => T;
  /** Saves the value and tells this page's subscribers. */
  write: (value: T) => void;
  /** Forgets the value: reads go back to the initial fallback. */
  clear: () => void;
  /** Called on a write in this page (with `changeEvent`) or in another tab. */
  subscribe: (changed: () => void) => () => void;
}

export interface StoredValueOptions<T> {
  key: string;
  /** Read when nothing valid is saved, during SSR and before the first write. */
  fallback: T;
  /** The value in the stored text; `undefined` when it is not valid. */
  parse: (raw: string) => T | undefined;
  serialize: (value: T) => string;
  /** Event fired on `window` after a write, so this page's readers update. */
  changeEvent?: string;
  /** Logged once when the browser refuses the storage (private window, blocked site data). */
  warning: string;
}

/**
 * A preference in `localStorage` with the app's rules: when storage is refused it is logged
 * once and the value lives in memory until the page closes, never throwing at the caller.
 */
export function createStoredValue<T>(options: StoredValueOptions<T>): StoredValue<T> {
  const { key, parse, serialize, changeEvent, warning } = options;
  let memory = options.fallback;
  let blocked = false;
  let warned = false;
  let cached: { raw: string; value: T | undefined } | undefined;

  function refuse(error: unknown) {
    blocked = true;
    if (warned) return;
    warned = true;
    logBrowserWarning(warning, error);
  }

  function parsed(raw: string): T | undefined {
    if (cached?.raw === raw) return cached.value;
    cached = { raw, value: parse(raw) };
    return cached.value;
  }

  function read(): T {
    if (typeof window === "undefined" || blocked) return memory;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return memory;
      return parsed(raw) ?? memory;
    } catch (error) {
      refuse(error);
      return memory;
    }
  }

  function announce() {
    if (changeEvent) window.dispatchEvent(new Event(changeEvent));
  }

  function write(value: T) {
    memory = value;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, serialize(value));
    } catch (error) {
      refuse(error);
    }
    announce();
  }

  function clear() {
    memory = options.fallback;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      refuse(error);
    }
    announce();
  }

  function subscribe(changed: () => void) {
    if (changeEvent) window.addEventListener(changeEvent, changed);
    window.addEventListener("storage", changed);
    return () => {
      if (changeEvent) window.removeEventListener(changeEvent, changed);
      window.removeEventListener("storage", changed);
    };
  }

  return { read, write, clear, subscribe };
}
