import { CircleAlert, ClipboardPaste, Ticket, UserRound, Video } from "lucide-react";
import type { ReactNode } from "react";
import type { BarInput } from "@/features/home/domain/bar-input";

/** Key drawn like a real key (thicker bottom border). */
function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-b-2 border-line-strong bg-surface-2 px-1.5 font-sans text-xs font-medium text-ink">
      {children}
    </kbd>
  );
}

/** Bar error notice: icon + sentence, aligned even when the line wraps. */
export function ErrorHint({ children }: { children: ReactNode }) {
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

/** Empty bar hint during a call: Enter goes back to it. */
const IN_CALL_HINT = (
  <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
    <span className="inline-flex items-center gap-1.5 max-sm:hidden">
      <Keycap>Enter</Keycap>
      volta à chamada
    </span>
    <span aria-hidden="true" className="size-1 rounded-full bg-line-strong max-sm:hidden" />
    <span className="inline-flex items-center gap-1.5">
      <ClipboardPaste className="size-4 text-ink-subtle" aria-hidden="true" />
      <span className="max-sm:hidden">ou cole o link que recebeu</span>
      <span className="sm:hidden">Cole o link de outra sala</span>
    </span>
  </span>
);

/** Hint below the bar: shortcuts when the bar is empty; recognized room; or the error. */
export function hintFor(
  input: BarInput,
  inCall = false,
): { text: ReactNode; tone: "muted" | "ok" | "error" } {
  switch (input.kind) {
    case "empty":
      return { text: inCall ? IN_CALL_HINT : EMPTY_HINT, tone: "muted" };
    case "friend":
      return {
        text: (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 py-0.5 pr-2.5 pl-2">
            <span className="sr-only">Código de amigo:</span>
            <UserRound className="size-3.5 text-brand-soft" aria-hidden="true" />
            <span className="font-sans font-medium text-ink tabular-nums">{input.code}</span>
          </span>
        ),
        tone: "ok",
      };
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
