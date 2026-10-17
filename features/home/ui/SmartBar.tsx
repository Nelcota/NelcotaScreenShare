import { ArrowRight, Link2, Loader2, Plus, Undo2, UserPlus } from "lucide-react";
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
import { parseBarInput, type BarInput } from "@/features/home/domain/bar-input";
import { ErrorHint, hintFor } from "./SmartBarHints";
import { useShortcut } from "@/lib/hooks/use-shortcut";
import { subscribeNothing } from "@/lib/hooks/subscribe-nothing";
import { cn } from "@/lib/utils";

interface SmartBarProps {
  invalidCode: boolean;
  pending: boolean;
  onNavigate: (href: string) => void;
  /** An empty bar's "Criar sala". */
  onCreateRoom: () => void;
  /** During a call: an empty bar goes back to it instead of creating a room. */
  onBackToCall?: () => void;
  /** Mascot "peeking" over the bar. */
  mascot: ReactNode;
  /** Whether "/" focuses this bar; only one bar on the page should answer it. */
  focusShortcut?: boolean;
  /** Shorter bar and button, for the start of the app. */
  compact?: boolean;
  /** Signed in: a friend code (NELC-…) in the bar adds that person instead of opening a room. */
  onAddFriend?: (code: string) => void;
}

function SubmitLabel({
  pending,
  input,
  inCall,
}: {
  pending: boolean;
  input: BarInput;
  inCall: boolean;
}) {
  if (pending) {
    return (
      <>
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Abrindo…
      </>
    );
  }
  if (input.kind === "empty" && inCall) {
    return (
      <>
        <Undo2 className="size-4" aria-hidden="true" />
        Voltar à chamada
      </>
    );
  }
  if (input.kind === "empty") {
    return (
      <>
        <Plus className="icon-turn size-4" aria-hidden="true" />
        Criar sala
      </>
    );
  }
  if (input.kind === "friend") {
    return (
      <>
        <UserPlus className="size-4" aria-hidden="true" />
        Adicionar
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
  onBackToCall,
  mascot,
  focusShortcut = true,
  compact = false,
  onAddFriend,
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
  const readInput = (value: string) => parseBarInput(value, { friends: onAddFriend !== undefined });
  const input = readInput(text);
  const inCall = onBackToCall !== undefined;
  const hint = linkError
    ? {
        text: <ErrorHint>Esse código de sala não existe. Confira o link.</ErrorHint>,
        tone: "error" as const,
      }
    : hintFor(input, inCall);

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
    const next = readInput(value);
    setMascotDoubt(next.kind === "invalid" && value.trim().length > 3);
    const recognized = next.kind === "room" || next.kind === "friend";
    if (recognized && next.kind !== input.kind) nodMascot();
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
    if (input.kind === "friend") {
      onAddFriend?.(input.code);
      setText("");
      return;
    }
    if (input.kind !== "room" && onBackToCall) {
      onBackToCall();
      return;
    }
    if (input.kind !== "room") {
      onCreateRoom();
      return;
    }
    onNavigate(roomLink(input.code, input.invite));
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      // The minimized call card never rests on top of this field.
      data-call-card-clear=""
      className="flex w-full flex-col items-center gap-3"
    >
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
            <SubmitLabel pending={pending} input={input} inCall={inCall} />
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
