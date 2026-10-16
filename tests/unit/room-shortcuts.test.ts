import { describe, expect, it } from "vitest";
import { matchesShortcut } from "@/lib/hooks/use-shortcut";
import {
  DEFAULT_SHORTCUT_KEYS,
  ROOM_SHORTCUTS,
  SHORTCUTS_HELP_KEY,
  isDefaultShortcutKeys,
  readShortcutKeys,
  shortcutKeyError,
} from "@/lib/shortcuts";

function keydown(key: string, modifiers: Partial<KeyboardEvent> = {}) {
  return {
    key,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: null,
    ...modifiers,
  };
}

describe("room shortcuts", () => {
  it("lists the help key last and every key once", () => {
    const keys = ROOM_SHORTCUTS.map(({ key }) => key);
    expect(keys.at(-1)).toBe(SHORTCUTS_HELP_KEY);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("opens the help with ? (Shift+/)", () => {
    expect(matchesShortcut(keydown("?", { shiftKey: true }), SHORTCUTS_HELP_KEY)).toBe(true);
    expect(matchesShortcut(keydown("/"), SHORTCUTS_HELP_KEY)).toBe(false);
  });

  it("matches letters in either case", () => {
    expect(matchesShortcut(keydown("m"), "m")).toBe(true);
    expect(matchesShortcut(keydown("M", { shiftKey: true }), "m")).toBe(true);
  });

  it("ignores modified and held-down keys", () => {
    for (const modifiers of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { repeat: true },
    ]) {
      expect(matchesShortcut(keydown("?", modifiers), SHORTCUTS_HELP_KEY)).toBe(false);
    }
  });
});

function choice(key: string, modifiers: Partial<KeyboardEvent> = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers };
}

describe("choosing a shortcut key", () => {
  it("accepts a free letter or digit in either case", () => {
    expect(shortcutKeyError(choice("K"), "mic", DEFAULT_SHORTCUT_KEYS)).toBeUndefined();
    expect(shortcutKeyError(choice("7"), "mic", DEFAULT_SHORTCUT_KEYS)).toBeUndefined();
    expect(shortcutKeyError(choice("m"), "mic", DEFAULT_SHORTCUT_KEYS)).toBeUndefined();
  });

  it.each([
    ["F4", { altKey: true }],
    ["w", { ctrlKey: true }],
    ["t", { ctrlKey: true }],
    ["q", { metaKey: true }],
  ])("refuses %s with a modifier", (key, modifiers) => {
    expect(shortcutKeyError(choice(key, modifiers), "mic", DEFAULT_SHORTCUT_KEYS)).toBe(
      "Use uma tecla só, sem Ctrl, Alt ou Cmd.",
    );
  });

  it.each(["F5", "F11", "Escape", "Tab", "Enter", " ", "ArrowUp", "?", "/"])(
    "refuses %s",
    (key) => {
      expect(shortcutKeyError(choice(key), "mic", DEFAULT_SHORTCUT_KEYS)).toBe(
        "Escolha uma letra ou um número.",
      );
    },
  );

  it("refuses a key another shortcut already uses", () => {
    expect(shortcutKeyError(choice("c"), "mic", DEFAULT_SHORTCUT_KEYS)).toBe(
      "Essa tecla já é de “Abre e fecha o chat”.",
    );
    expect(shortcutKeyError(choice("E"), "mic", DEFAULT_SHORTCUT_KEYS)).toBe(
      "Essa tecla já é usada para sair da sala.",
    );
  });
});

describe("saved shortcut keys", () => {
  it("keeps a valid swap", () => {
    const keys = readShortcutKeys({ mic: "S", share: "m" });
    expect(keys.mic).toBe("s");
    expect(keys.share).toBe("m");
    expect(isDefaultShortcutKeys(keys)).toBe(false);
  });

  it("uses the default for a missing or invalid key", () => {
    const keys = readShortcutKeys({ mic: "k", chat: "F4", hand: 3 });
    expect(keys).toEqual({ ...DEFAULT_SHORTCUT_KEYS, mic: "k" });
  });

  it.each([null, "m", { mic: "c" }, { mic: "e" }])("falls back to the defaults for %j", (saved) => {
    expect(isDefaultShortcutKeys(readShortcutKeys(saved))).toBe(true);
  });
});
