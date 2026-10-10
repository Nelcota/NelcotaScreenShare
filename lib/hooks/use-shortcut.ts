import { createContext, use, useEffect, useEffectEvent } from "react";

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, select"))
  );
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
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() !== key || isTyping(event.target)) return;
      event.preventDefault();
      handle();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [key, active]);
}
