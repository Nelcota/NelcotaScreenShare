/** Key that opens the shortcuts help in the room. */
export const SHORTCUTS_HELP_KEY = "?";

/** Room key that is not in the list (it opens "Sair da sala?") and cannot be chosen. */
export const LEAVE_SHORTCUT_KEY = "e";

/** Every room shortcut but the help can get another key. */
export type ShortcutId =
  | "mic"
  | "camera"
  | "share"
  | "fullscreen"
  | "popout"
  | "point"
  | "hand"
  | "chat";

/** Lowercase key of each configurable shortcut. */
export type ShortcutKeys = Readonly<Record<ShortcutId, string>>;

export const DEFAULT_SHORTCUT_KEYS: ShortcutKeys = Object.freeze({
  mic: "m",
  camera: "v",
  share: "s",
  fullscreen: "f",
  popout: "j",
  point: "p",
  hand: "h",
  chat: "c",
});

interface RoomShortcut {
  id: ShortcutId | "help";
  /** The default key, as printed on the keyboard. */
  key: string;
  action: string;
}

function defaultShortcut(id: ShortcutId, action: string): RoomShortcut {
  return { id, key: DEFAULT_SHORTCUT_KEYS[id].toUpperCase(), action };
}

/** Room keyboard shortcuts (see `useShortcut`). Shown in the help dialog, the home page and the README. */
export const ROOM_SHORTCUTS: readonly RoomShortcut[] = [
  defaultShortcut("mic", "Liga e desliga o microfone"),
  defaultShortcut("camera", "Liga e desliga a câmera"),
  defaultShortcut("share", "Compartilha a tela"),
  defaultShortcut("fullscreen", "Tela cheia no palco"),
  defaultShortcut("popout", "Abre a tela de outra pessoa em janela"),
  defaultShortcut("point", "Aponta na tela de outra pessoa"),
  defaultShortcut("hand", "Levanta ou baixa a mão"),
  defaultShortcut("chat", "Abre e fecha o chat"),
  { id: "help", key: SHORTCUTS_HELP_KEY, action: "Esta ajuda" },
];

export const CONFIGURABLE_SHORTCUTS = ROOM_SHORTCUTS.filter(
  (shortcut): shortcut is RoomShortcut & { id: ShortcutId } => shortcut.id !== "help",
);

/** The keydown fields that decide whether a key can become a shortcut. */
export type KeyChoice = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">;

const SINGLE_LETTER_OR_DIGIT = /^[\p{L}\p{N}]$/u;

/**
 * Why `choice` cannot be the key of `id`, or `undefined` when it can. Only a letter or
 * a digit alone: combinations with Ctrl, Alt or Cmd, function keys, Esc, Tab, Enter,
 * space and arrows belong to the browser, the system or the page.
 */
export function shortcutKeyError(
  choice: KeyChoice,
  id: ShortcutId,
  keys: ShortcutKeys,
): string | undefined {
  if (choice.ctrlKey || choice.metaKey || choice.altKey) {
    return "Use uma tecla só, sem Ctrl, Alt ou Cmd.";
  }
  const key = choice.key.toLowerCase();
  if (!SINGLE_LETTER_OR_DIGIT.test(key)) return "Escolha uma letra ou um número.";
  if (key === LEAVE_SHORTCUT_KEY) return "Essa tecla já é usada para sair da sala.";
  const owner = CONFIGURABLE_SHORTCUTS.find(
    (shortcut) => shortcut.id !== id && keys[shortcut.id] === key,
  );
  if (owner) return `Essa tecla já é de “${owner.action}”.`;
  return undefined;
}

function savedKey(saved: object, id: ShortcutId): string {
  const key: unknown = Object.getOwnPropertyDescriptor(saved, id)?.value;
  if (typeof key !== "string") return DEFAULT_SHORTCUT_KEYS[id];
  const lowercase = key.toLowerCase();
  if (!SINGLE_LETTER_OR_DIGIT.test(lowercase) || lowercase === LEAVE_SHORTCUT_KEY) {
    return DEFAULT_SHORTCUT_KEYS[id];
  }
  return lowercase;
}

/** Saved keys; anything invalid or a key used twice brings back the defaults. */
export function readShortcutKeys(saved: unknown): ShortcutKeys {
  if (!saved || typeof saved !== "object") return DEFAULT_SHORTCUT_KEYS;
  const keys = CONFIGURABLE_SHORTCUTS.reduce<ShortcutKeys>(
    (result, { id }) => ({ ...result, [id]: savedKey(saved, id) }),
    DEFAULT_SHORTCUT_KEYS,
  );
  const used = new Set(Object.values(keys));
  if (used.size !== CONFIGURABLE_SHORTCUTS.length) return DEFAULT_SHORTCUT_KEYS;
  return Object.freeze(keys);
}

export function isDefaultShortcutKeys(keys: ShortcutKeys): boolean {
  return CONFIGURABLE_SHORTCUTS.every(({ id }) => keys[id] === DEFAULT_SHORTCUT_KEYS[id]);
}
