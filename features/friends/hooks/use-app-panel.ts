import { useEffect, useEffectEvent, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router";

/** The app's start: the mascots and the room bar, with nothing picked in the column. */
const APP_START = "/inicio";

/** Paths with nothing open in the middle; anything else is a panel that can close. */
const RESTING_PATHS = new Set([APP_START, "/amigos", "/salas", "/times"]);

export function useClosePanel() {
  const navigate = useNavigate();
  return () => {
    void navigate(APP_START, { viewTransition: true });
  };
}

/** Esc closes the panel in the middle, unless a dialog, menu or field has the key. */
export function useCloseOnEscape() {
  const { pathname } = useLocation();
  const close = useClosePanel();
  const onEscape = useEffectEvent(close);
  const open = !RESTING_PATHS.has(pathname);
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("[role=dialog], [role=alertdialog], [role=menu]")) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input, textarea, select")) return;
      onEscape();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [open]);
}

/** Clicking the item already open in the middle closes it instead. */
export function useToggleLink(to: string) {
  const { pathname } = useLocation();
  const close = useClosePanel();
  const current = pathname === to;
  const onClick = (event: MouseEvent) => {
    if (!current) return;
    event.preventDefault();
    close();
  };
  return { current, onClick };
}
