import { useSyncExternalStore } from "react";
import { useShortcut } from "@/lib/hooks/use-shortcut";
import {
  DEFAULT_SHORTCUT_KEYS,
  readShortcutKeys,
  type ShortcutId,
  type ShortcutKeys,
} from "@/lib/shortcuts";
import { logBrowserWarning } from "@/lib/telemetry.client";

const STORAGE_KEY = "nelcota-shortcut-keys";
const CHANGE_EVENT = "nelcota-shortcut-keys-change";
let fallback: ShortcutKeys = DEFAULT_SHORTCUT_KEYS;
let storageBlocked = false;
let warned = false;
let cached: { raw: string | null; keys: ShortcutKeys } | undefined;

function warn(error: unknown) {
  if (warned) return;
  warned = true;
  logBrowserWarning("Could not access shortcut keys storage", error);
}

function parse(raw: string | null): ShortcutKeys {
  if (!raw) return DEFAULT_SHORTCUT_KEYS;
  try {
    return readShortcutKeys(JSON.parse(raw));
  } catch {
    return DEFAULT_SHORTCUT_KEYS;
  }
}

/** The same object while the saved value does not change (`useSyncExternalStore`). */
function currentShortcutKeys(): ShortcutKeys {
  if (storageBlocked) return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (cached?.raw !== raw) cached = { raw, keys: parse(raw) };
    return cached.keys;
  } catch (error) {
    storageBlocked = true;
    warn(error);
    return fallback;
  }
}

/** Keeps the keys in this browser; without storage they last until the page reloads. */
export function saveShortcutKeys(keys: ShortcutKeys) {
  fallback = keys;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch (error) {
    storageBlocked = true;
    warn(error);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(changed: () => void) {
  window.addEventListener(CHANGE_EVENT, changed);
  window.addEventListener("storage", changed);
  return () => {
    window.removeEventListener(CHANGE_EVENT, changed);
    window.removeEventListener("storage", changed);
  };
}

/** The room keys chosen in this browser (the defaults during SSR). */
export function useShortcutKeys(): ShortcutKeys {
  return useSyncExternalStore(subscribe, currentShortcutKeys, () => DEFAULT_SHORTCUT_KEYS);
}

/** `useShortcut` with the key this browser chose for the room shortcut `id`. */
export function useRoomShortcut(id: ShortcutId, onPress: () => void, enabled = true) {
  const keys = useShortcutKeys();
  useShortcut(keys[id], onPress, enabled);
}

/** The key of the room shortcut `id` as shown in hints and `aria-keyshortcuts` ("M"). */
export function useShortcutLabel(id: ShortcutId): string {
  return useShortcutKeys()[id].toUpperCase();
}
