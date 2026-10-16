import { createContext, use, useEffect, useEffectEvent } from "react";

type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "repeat" | "ctrlKey" | "metaKey" | "altKey" | "target"
>;

function isTyping(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined") return false;
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, select"))
  );
}

/**
 * Dialogs and menus that are still open. One that is closing stays in the page for its exit
 * animation (`data-state="closed"`) and can keep the focus, as after picking a reaction:
 * it no longer takes the keys.
 */
const OPEN_OVERLAY = ["dialog", "alertdialog", "menu"]
  .map((role) => `[role=${role}]:not([data-state=closed])`)
  .join(", ");

/** Focus inside an open dialog or menu: its keys belong to it, not to the room. */
function isInsideOverlay(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined") return false;
  return target instanceof HTMLElement && target.closest(OPEN_OVERLAY) !== null;
}

/**
 * Whether a keydown triggers the shortcut `key`. Shift is allowed, so "?" (Shift+/)
 * works; Ctrl, Cmd, Alt, held-down keys, typing in a field and keys pressed inside an open
 * dialog or menu never trigger it.
 */
export function matchesShortcut(event: ShortcutEvent, key: string): boolean {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key.toLowerCase() !== key) return false;
  return !isTyping(event.target) && !isInsideOverlay(event.target);
}

/**
 * Turns off every shortcut below it. The room uses it while minimized, so that
 * typing in another page (the admin panel) does not toggle the mic or the share.
 */
export const ShortcutScope = createContext(true);

/** The call's shortcut switch is independent of whether the call is minimized. */
export const ShortcutSettings = createContext<{
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
} | null>(null);

/**
 * Single-key shortcut, without modifiers. Ignored while the person is typing
 * (chat, fields) and while the key is held down. `key` in lowercase, like "m".
 */
export function useShortcut(key: string, onPress: () => void, enabled = true) {
  const handle = useEffectEvent(onPress);
  const scopeActive = use(ShortcutScope);
  const settings = use(ShortcutSettings);
  const active = enabled && scopeActive && (settings?.enabled ?? true);

  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => {
      if (!matchesShortcut(event, key)) return;
      event.preventDefault();
      handle();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [key, active]);
}
