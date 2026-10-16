import { createContext, use, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { prefersReducedMotion } from "@/lib/animation/motion";
import { cn } from "@/lib/utils";
import { SettingsRowLabel } from "./Settings";

const RowContext = createContext<(() => void) | null>(null);

/** Event to open a row by id (e.g. the checklist's "Ativar"). */
export const OPEN_ROW_EVENT = "conta:abrir-linha";

/**
 * Closes the surrounding expandable row, if any. Forms use it for
 * "Cancelar" and to close after saving; outside a row, it returns null.
 */
export function useCloseRow(): (() => void) | null {
  return use(RowContext);
}

/**
 * Row that shows only the current state and a button; the form opens inside the
 * row itself. The content stays mounted when closed (`hidden`): a flow in progress,
 * like the backup codes, is not lost. Focus goes to the first field on open
 * and back to the button on close.
 */
function triggerVariant(open: boolean, danger: boolean | undefined) {
  if (open) return "ghost";
  if (danger) return "destructive";
  return "outline";
}

export function ExpandableRow({
  id,
  title,
  description,
  summary,
  actionLabel,
  openLabel = "Fechar",
  danger = false,
  children,
}: {
  /** Row anchor: `/conta#id` opens the row already expanded. */
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Current state, beside the button (e.g. the e-mail, "Desativada"). */
  summary?: ReactNode;
  actionLabel: string;
  /** Button text while the row is open. */
  openLabel?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasSummary = summary !== undefined && summary !== null;
  const contentId = useId();
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  const row = useRef<HTMLDivElement>(null);
  // Opened by anchor or event: scrolls to the row before focusing the field.
  const revealOnOpen = useRef(false);

  // Opens from the URL anchor or from the event (the same link clicked again
  // does not change the hash, so the event covers that case).
  useEffect(() => {
    if (!id) return;
    const reveal = () => {
      revealOnOpen.current = true;
      setOpen(true);
    };
    const openIfTarget = () => {
      if (window.location.hash === `#${id}`) reveal();
    };
    const onOpen = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === id) reveal();
    };
    openIfTarget();
    window.addEventListener("hashchange", openIfTarget);
    window.addEventListener(OPEN_ROW_EVENT, onOpen);
    return () => {
      window.removeEventListener("hashchange", openIfTarget);
      window.removeEventListener(OPEN_ROW_EVENT, onOpen);
    };
  }, [id]);

  useEffect(() => {
    function moveFocus() {
      if (!open) {
        if (wasOpen.current) trigger.current?.focus();
        return;
      }
      const field = content.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]), textarea, select, button",
      );
      if (!revealOnOpen.current) {
        field?.focus();
        return;
      }
      revealOnOpen.current = false;
      const behavior = prefersReducedMotion() ? "auto" : "smooth";
      row.current?.scrollIntoView({ behavior, block: "start" });
      field?.focus({ preventScroll: true });
    }

    moveFocus();
    wasOpen.current = open;
  }, [open]);

  return (
    <div
      ref={row}
      id={id}
      className={cn(
        "grid scroll-mt-6 gap-4 px-5 py-5 sm:gap-x-6 sm:px-6",
        hasSummary
          ? "sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
          : "sm:grid-cols-[minmax(0,1fr)_auto]",
      )}
    >
      <SettingsRowLabel id={titleId} title={title} description={description} />
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-3",
          hasSummary ? "justify-between sm:self-center" : "justify-start sm:self-start",
        )}
      >
        {hasSummary ? <div className="min-w-0 text-sm text-ink-muted">{summary}</div> : null}
        <Button
          ref={trigger}
          type="button"
          variant={triggerVariant(open, danger)}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen(!open)}
        >
          {open ? openLabel : actionLabel}
        </Button>
      </div>
      <section
        ref={content}
        id={contentId}
        aria-labelledby={titleId}
        hidden={!open}
        className={cn("min-w-0", hasSummary ? "sm:col-start-2" : "sm:col-span-2")}
      >
        <RowContext value={() => setOpen(false)}>{children}</RowContext>
      </section>
    </div>
  );
}
