import { X } from "lucide-react";
import { Hint } from "@/components/Hint";
import { useClosePanel } from "@/features/friends/hooks/use-app-panel";
import { cn } from "@/lib/utils";

/** The X in the corner of the panel in the middle; phones use the back link instead. */
export function PanelClose({ className }: { className?: string }) {
  const close = useClosePanel();
  return (
    <Hint text="Fechar" shortcut="Esc">
      <button
        type="button"
        aria-label="Fechar"
        aria-keyshortcuts="Escape"
        onClick={close}
        className={cn(
          "grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand max-sm:hidden",
          className,
        )}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </Hint>
  );
}
