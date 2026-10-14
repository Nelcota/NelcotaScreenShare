import { CircleHelp } from "lucide-react";
import { use, useId, useState, type KeyboardEvent } from "react";
import { FormError } from "@/components/FormError";
import { Hint } from "@/components/Hint";
import { navItemClass } from "@/components/shell/nav-item-class";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ShortcutSettings, useShortcut } from "@/lib/hooks/use-shortcut";
import { saveShortcutKeys, useShortcutKeys } from "@/lib/hooks/use-shortcut-keys";
import {
  CONFIGURABLE_SHORTCUTS,
  DEFAULT_SHORTCUT_KEYS,
  SHORTCUTS_HELP_KEY,
  isDefaultShortcutKeys,
  shortcutKeyError,
  type ShortcutId,
} from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

const LABEL = "Atalhos de teclado";
const KEY_CLASS =
  "grid size-7 place-items-center rounded-lg border border-line-strong bg-surface-2 font-sans text-xs font-semibold text-ink";
/** Keys that only modify another one: wait for the real key. */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "AltGraph", "Meta", "CapsLock"]);

function ShortcutsSwitch() {
  const settings = use(ShortcutSettings);
  const switchId = useId();
  if (!settings) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
      <label htmlFor={switchId} className="text-sm font-medium">
        Atalhos na sala
      </label>
      <Switch id={switchId} checked={settings.enabled} onCheckedChange={settings.setEnabled} />
    </div>
  );
}

interface KeyEditing {
  editing: ShortcutId | undefined;
  setEditing: (id: ShortcutId | undefined) => void;
  error: string | undefined;
  setError: (error: string | undefined) => void;
}

function useKeyEditing(): KeyEditing {
  const [editing, setEditing] = useState<ShortcutId>();
  const [error, setError] = useState<string>();
  return { editing, setEditing, error, setError };
}

/** The key of one shortcut: a click waits for the new key, Esc or leaving the button cancels. */
function ShortcutKeyButton({
  id,
  action,
  editor,
}: {
  id: ShortcutId;
  action: string;
  editor: KeyEditing;
}) {
  const keys = useShortcutKeys();
  const listening = editor.editing === id;
  const key = keys[id].toUpperCase();

  function stop() {
    editor.setEditing(undefined);
    editor.setError(undefined);
  }

  function choose(event: KeyboardEvent<HTMLButtonElement>) {
    if (!listening) return;
    // The room shortcuts listen on window: the chosen key must not trigger them.
    event.stopPropagation();
    if (event.key === "Tab" || MODIFIER_KEYS.has(event.key)) return;
    event.preventDefault();
    if (event.key === "Escape") {
      stop();
      return;
    }
    const error = shortcutKeyError(event, id, keys);
    if (error) {
      editor.setError(error);
      return;
    }
    saveShortcutKeys({ ...keys, [id]: event.key.toLowerCase() });
    stop();
  }

  return (
    <button
      type="button"
      aria-label={`${key}: ${action}. Trocar tecla`}
      aria-pressed={listening}
      onClick={() => {
        editor.setError(undefined);
        editor.setEditing(listening ? undefined : id);
      }}
      onKeyDown={choose}
      // Space clicks a button on keyup: while waiting, it is a refused key, not a click.
      onKeyUp={(event) => {
        if (listening) event.preventDefault();
      }}
      onBlur={() => {
        if (listening) stop();
      }}
      className={cn(
        KEY_CLASS,
        "cursor-pointer transition-colors hover:border-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/55",
        listening && "border-brand bg-brand/15",
      )}
    >
      {listening ? "…" : key}
    </button>
  );
}

function ShortcutsTable({ editor }: { editor: KeyEditing }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
      {CONFIGURABLE_SHORTCUTS.map(({ id, action }) => (
        <div key={id} className="contents">
          <dt>
            <ShortcutKeyButton id={id} action={action} editor={editor} />
          </dt>
          <dd className="text-sm text-ink-muted">{action}</dd>
        </div>
      ))}
      <dt>
        <kbd className={KEY_CLASS}>{SHORTCUTS_HELP_KEY}</kbd>
      </dt>
      <dd className="text-sm text-ink-muted">Esta ajuda</dd>
    </dl>
  );
}

function EditingStatus({ editor }: { editor: KeyEditing }) {
  if (editor.error) return <FormError message={editor.error} />;
  return (
    <p aria-live="polite" className="text-sm text-ink-muted">
      {editor.editing ? "Aperte a nova tecla." : "Clique numa tecla para trocar."}
    </p>
  );
}

function RestoreDefaults({ editor }: { editor: KeyEditing }) {
  const keys = useShortcutKeys();
  if (isDefaultShortcutKeys(keys)) return null;
  return (
    <Button
      variant="ghost"
      onClick={() => {
        editor.setEditing(undefined);
        editor.setError(undefined);
        saveShortcutKeys(DEFAULT_SHORTCUT_KEYS);
      }}
    >
      Restaurar padrão
    </Button>
  );
}

/** "?" in the top bar (or the "?" key): the room shortcuts, their keys and the switch to turn them off. */
export function ShortcutsHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const editor = useKeyEditing();
  useShortcut(SHORTCUTS_HELP_KEY, () => setOpen(true), !open);

  function changeOpen(next: boolean) {
    setOpen(next);
    editor.setEditing(undefined);
    editor.setError(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Hint text={LABEL}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={LABEL}
          className={cn(navItemClass, "w-9 justify-center px-0", className)}
        >
          <CircleHelp className="size-4" aria-hidden="true" />
        </button>
      </Hint>
      <DialogContent
        showCloseButton={false}
        // Esc while waiting for a key cancels the change, not the dialog.
        onEscapeKeyDown={(event) => {
          if (editor.editing) event.preventDefault();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <DialogTitle>{LABEL}</DialogTitle>
          <DialogDescription className="text-ink-muted">
            Desligue para jogar sem acionar a chamada.
          </DialogDescription>
        </div>
        <ShortcutsSwitch />
        <ShortcutsTable editor={editor} />
        <EditingStatus editor={editor} />
        <div className="flex justify-end gap-2">
          <RestoreDefaults editor={editor} />
          <DialogClose asChild>
            <Button>Entendi</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
