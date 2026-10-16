import {
  ArrowRight,
  CircleAlert,
  ClipboardPaste,
  Link2,
  Loader2,
  Plus,
  Ticket,
  Video,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  celebrateMascot,
  nodMascot,
  setMascotDoubt,
  upsetMascot,
} from "@/features/mascot/client/events";
import { roomLink } from "@/features/room/domain/room-code";
import { parseRoomInput, type RoomInput } from "@/features/room/domain/room-input";
import { useShortcut } from "@/lib/hooks/use-shortcut";
import { subscribeNothing } from "@/lib/hooks/subscribe-nothing";
import { cn } from "@/lib/utils";

interface SmartBarProps {
  invalidCode: boolean;
  pending: boolean;
  onNavigate: (href: string) => void;
  /** An empty bar's "Criar sala". */
  onCreateRoom: () => void;
  /** Mascot "peeking" over the bar. */
  mascot: ReactNode;
  /** Whether "/" focuses this bar; only one bar on the page should answer it. */
  focusShortcut?: boolean;
  /** Shorter bar and button, for the start of the app. */
  compact?: boolean;
}

/** Key drawn like a real key (thicker bottom border). */
function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-b-2 border-line-strong bg-surface-2 px-1.5 font-sans text-xs font-medium text-ink">
      {children}
    </kbd>
  );
}

/** Bar error notice: icon + sentence, aligned even when the line wraps. */
function ErrorHint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1.5 text-left">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

/** Empty bar hint: two short shortcuts, side by side. */
const EMPTY_HINT = (
  <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
    <span className="inline-flex items-center gap-1.5 max-sm:hidden">
      <Keycap>Enter</Keycap>
      cria uma sala
    </span>
    <span aria-hidden="true" className="size-1 rounded-full bg-line-strong max-sm:hidden" />
    <span className="inline-flex items-center gap-1.5 max-sm:hidden">
      <ClipboardPaste className="size-4 text-ink-subtle" aria-hidden="true" />
      ou cole o link que recebeu
    </span>
    <span className="inline-flex items-center gap-1.5 sm:hidden">
      <ClipboardPaste className="size-4 text-ink-subtle" aria-hidden="true" />
      Toque em Criar sala ou cole o link que recebeu
    </span>
  </span>
);

/** Hint below the bar: shortcuts when the bar is empty; recognized room; or the error. */
function hintFor(input: RoomInput): { text: ReactNode; tone: "muted" | "ok" | "error" } {
  switch (input.kind) {
    case "empty":
      return { text: EMPTY_HINT, tone: "muted" };
    case "room":
      return {
        text: (
          <span className="inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
            <span className="sr-only">Sala encontrada:</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 py-0.5 pr-2.5 pl-2">
              <Video className="size-3.5 text-brand-soft" aria-hidden="true" />
              <span className="font-sans font-medium text-ink tabular-nums">{input.code}</span>
            </span>
            {input.invite ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pr-2.5 pl-2 text-xs font-medium">
                <Ticket className="size-3.5 text-ink-subtle" aria-hidden="true" />
                convite
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-ink-muted max-sm:hidden">
              <Keycap>Enter</Keycap>
              para entrar
            </span>
          </span>
        ),
        tone: "ok",
      };
    case "invalid":
      return {
        text: (
          <ErrorHint>
            {input.reason === "not-a-room"
              ? "Esse link não é de uma sala do Nelcota."
              : "Confira o código: letras, números e hífens, como kfa-mtrx-q2p."}
          </ErrorHint>
        ),
        tone: "error",
      };
  }
}

function SubmitLabel({ pending, creating }: { pending: boolean; creating: boolean }) {
  if (pending) {
    return (
      <>
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Abrindo…
      </>
    );
  }
  if (creating) {
    return (
      <>
        <Plus className="icon-turn size-4" aria-hidden="true" />
        Criar sala
      </>
    );
  }
  return (
    <>
      <ArrowRight className="icon-nudge size-4" aria-hidden="true" />
      Entrar
    </>
  );
}

/**
 * The home bar: when empty, creates a room; with a code or a pasted link
 * (with or without an invite), joins. The "/" key anywhere focuses the bar.
 */
export function SmartBar({
  invalidCode,
  pending,
  onNavigate,
  onCreateRoom,
  mascot,
  focusShortcut = true,
  compact = false,
}: SmartBarProps) {
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const disabled = pending || !hydrated;
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  // Typing dismisses the error that came in the address; a new error remounts the bar (key).
  const [errorDismissed, setErrorDismissed] = useState(false);
  const linkError = invalidCode && !errorDismissed;
  const input = parseRoomInput(text);
  const hint = linkError
    ? {
        text: <ErrorHint>Esse código de sala não existe. Confira o link.</ErrorHint>,
        tone: "error" as const,
      }
    : hintFor(input);

  useEffect(() => {
    if (!invalidCode) return;
    inputRef.current?.focus();
    upsetMascot("worried", inputRef.current ?? undefined);
  }, [invalidCode]);

  // "/" focuses the bar (outside text fields), like in search engines.
  useShortcut("/", () => {
    if (!focusShortcut) return;
    inputRef.current?.focus();
  });

  useEffect(() => () => setMascotDoubt(false), []);

  function handleChange(value: string) {
    setText(value);
    setErrorDismissed(true);
    const next = parseRoomInput(value);
    setMascotDoubt(next.kind === "invalid" && value.trim().length > 3);
    if (next.kind === "room" && input.kind !== "room") nodMascot();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (input.kind === "invalid") {
      inputRef.current?.focus();
      upsetMascot("grumpy", inputRef.current ?? undefined);
      return;
    }
    celebrateMascot();
    if (input.kind !== "room") {
      onCreateRoom();
      return;
    }
    onNavigate(roomLink(input.code, input.invite));
  }

  // "Criar sala" only with an empty bar; with text, the person is trying to join.
  const creating = input.kind === "empty";
  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col items-center gap-3">
      <div className="relative w-full">
        {/* The feet go in front of the bar's border, without being clipped by it. */}
        <div className="relative z-20 flex justify-center">{mascot}</div>
        <div
          className={cn(
            "relative z-10 flex items-center gap-2 rounded-full border border-line bg-surface pr-2 pl-5 shadow-[0_12px_32px_-20px_rgb(0_0_0/0.45)] transition-colors focus-within:border-brand/60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            compact ? "h-13" : "h-16",
            hint.tone === "error" && "border-danger/60 focus-within:border-danger/70",
          )}
        >
          <Link2 className="size-5 shrink-0 text-ink-subtle max-sm:hidden" aria-hidden="true" />
          <label htmlFor={inputId} className="sr-only">
            Link ou código da sala
          </label>
          <input
            ref={inputRef}
            disabled={disabled}
            id={inputId}
            value={text}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="Link ou código da sala"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            aria-describedby={hintId}
            aria-invalid={hint.tone === "error" || undefined}
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-subtle",
              !compact && "sm:text-lg",
            )}
          />
          <button
            type="submit"
            disabled={disabled}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full bg-brand font-medium text-brand-ink transition-[transform,background-color] duration-200 hover:bg-brand-hover active:scale-[0.97] disabled:bg-disabled disabled:text-disabled-ink motion-reduce:active:scale-100",
              compact ? "h-10 px-4 text-sm" : "h-12 px-5 text-base",
            )}
          >
            <SubmitLabel pending={pending} creating={creating} />
          </button>
        </div>
      </div>
      <p
        id={hintId}
        aria-live="polite"
        className={cn(
          "flex min-h-7 items-center justify-center px-4 text-center text-sm",
          hint.tone === "muted" && "text-ink-muted",
          hint.tone === "ok" && "text-ink",
          hint.tone === "error" && "text-danger",
        )}
      >
        {/* A single child: in flex, text and <strong> would become items and the space between them would vanish. */}
        <span>{hint.text}</span>
      </p>
    </form>
  );
}
