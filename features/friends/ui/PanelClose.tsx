import { X } from "lucide-react";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import { useClosePanel } from "@/features/friends/hooks/use-app-panel";
import { cn } from "@/lib/utils";

/** The X in the corner of the panel in the middle; phones use the back link instead. */
export function PanelClose({ className }: { className?: string }) {
  const close = useClosePanel();
  return (
    <Hint text="Fechar" shortcut="Esc">
      <Button
        type="button"
        variant="quiet"
        size="icon-lg"
        aria-label="Fechar"
        aria-keyshortcuts="Escape"
        onClick={close}
        className={cn("max-sm:hidden", className)}
      >
        <X aria-hidden="true" />
      </Button>
    </Hint>
  );
}
