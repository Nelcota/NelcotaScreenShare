import { prefersReducedMotion } from "@/lib/animation/motion";

export type Theme = "dark" | "light";

const STORAGE_KEY = "nelcota:tema";

/** Browser bar color (phone) for each theme: same as `--color-canvas`. */
export const THEME_COLOR: Record<Theme, string> = { dark: "#17181a", light: "#e7ebe6" };

/**
 * Runs in <head> before the first paint: applies the saved theme or, with no saved
 * choice, the system one. Keeps the page from flashing in the wrong theme.
 * Keep this script literal; the theme tests check its colors against THEME_COLOR.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("nelcota:tema")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==="light"?"#e7ebe6":"#17181a"})()`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the theme only lasts until reload.
  }
}

/** Applies the theme with a smooth transition of every color at once, where the browser supports it. */
export function switchTheme(theme: Theme) {
  if (document.startViewTransition && !prefersReducedMotion()) {
    document.startViewTransition(() => applyTheme(theme));
    return;
  }
  applyTheme(theme);
}

/** Notifies whoever depends on the theme (button, toasts) when the attribute changes. */
export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
