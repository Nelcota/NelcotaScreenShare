import { PhoneOff } from "lucide-react";
import { Popover } from "radix-ui";
import { useRef, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { useShortcut } from "@/lib/hooks/use-shortcut";
import { LEAVE_SHORTCUT_KEY } from "@/lib/shortcuts";
import { DockButton } from "./DockButton";
import { DockPopoverContent } from "./DockPopover";

/** "Sair da sala?" with Cancelar and Sair, for the dock and the minimized call. */
export function LeaveConfirm({
  onCancel,
  onConfirm,
  ...props
}: { onCancel: () => void; onConfirm: () => void } & ComponentProps<typeof DockPopoverContent>) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  return (
    <DockPopoverContent
      role="alertdialog"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        confirmRef.current?.focus();
      }}
      aria-label="Sair da sala?"
      className="w-[min(18rem,calc(100vw-2rem))] p-4"
      {...props}
    >
      <p className="text-sm font-medium tracking-tight">Sair da sala?</p>
      <p className="mt-1 text-xs text-ink-subtle">
        Seu microfone e o compartilhamento de tela serão encerrados.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          ref={confirmRef}
          className="bg-danger text-canvas hover:bg-danger/90"
          onClick={onConfirm}
        >
          Sair
        </Button>
      </div>
    </DockPopoverContent>
  );
}

/**
 * Leaving asks for confirmation: an accidental click does not drop the call.
 * Shortcut E opens the confirmation; Enter confirms and Esc cancels.
 */
export function LeaveMenu({ onLeave }: { onLeave: () => void }) {
  const [open, setOpen] = useState(false);

  useShortcut(LEAVE_SHORTCUT_KEY, () => setOpen(true), !open);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <DockButton
          label="Sair da sala"
          tone="danger"
          caption="Sair"
          pressed={open}
          shortcut="E"
          aria-haspopup="dialog"
          // Wider than the others: the one red button ends the call.
          iconClassName="w-14 sm:w-16"
        >
          <PhoneOff className="size-5" aria-hidden="true" />
        </DockButton>
      </Popover.Trigger>
      <LeaveConfirm
        align="end"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onLeave();
        }}
      />
    </Popover.Root>
  );
}
