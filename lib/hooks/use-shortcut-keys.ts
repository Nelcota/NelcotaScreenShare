import { useShortcut } from "@/lib/hooks/use-shortcut";
import {
  DEFAULT_SHORTCUT_KEYS,
  readShortcutKeys,
  type ShortcutId,
  type ShortcutKeys,
} from "@/lib/shortcuts";
import { useStoredValue } from "@/lib/hooks/use-stored-value";
import { createStoredValue } from "@/lib/stored-value";

function parse(raw: string): ShortcutKeys {
  try {
    return readShortcutKeys(JSON.parse(raw));
  } catch {
    return DEFAULT_SHORTCUT_KEYS;
  }
}

const shortcutKeys = createStoredValue<ShortcutKeys>({
  key: "nelcota-shortcut-keys",
  changeEvent: "nelcota-shortcut-keys-change",
  fallback: DEFAULT_SHORTCUT_KEYS,
  parse,
  serialize: (keys) => JSON.stringify(keys),
  warning: "Could not access shortcut keys storage",
});

/** Keeps the keys in this browser; without storage they last until the page reloads. */
export const saveShortcutKeys = shortcutKeys.write;

/** The room keys chosen in this browser (the defaults during SSR). */
export function useShortcutKeys(): ShortcutKeys {
  return useStoredValue(shortcutKeys, DEFAULT_SHORTCUT_KEYS);
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
