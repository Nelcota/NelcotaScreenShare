import { Pencil } from "lucide-react";
import { Popover } from "radix-ui";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import type { AnnotationControl } from "@/features/room/hooks/use-annotations";
import { GlassPopoverContent } from "@/components/GlassPopover";

export function AnnotationTools({
  control,
  onStart,
}: {
  control: AnnotationControl;
  onStart: () => void;
}) {
  if (!control.available) return null;
  return (
    <Popover.Root>
      <Hint text="Anotar na tela">
        <Popover.Trigger
          aria-label="Anotar na tela"
          className="glass pointer-events-auto grid size-9 place-items-center rounded-xl"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Popover.Trigger>
      </Hint>
      <GlassPopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        onCloseAutoFocus={(event) => event.preventDefault()}
        width="sm"
        className="flex flex-col gap-2 p-3"
      >
        <p className="text-sm text-ink-muted">
          Marcas somem após 10 segundos. O vídeo em janela (PiP) não inclui estas anotações.
        </p>
        {(
          [
            ["arrow", "Seta"],
            ["circle", "Círculo"],
            ["pen", "Caneta"],
          ] as const
        ).map(([tool, label]) => (
          <Popover.Close key={tool} asChild>
            <Button
              variant="ghost"
              onClick={() => {
                onStart();
                control.setTool(tool);
              }}
            >
              {label}
            </Button>
          </Popover.Close>
        ))}
        <Button variant="ghost" onClick={() => control.setTool(undefined)}>
          Parar de anotar
        </Button>
        <Button variant="ghost" onClick={control.removeOwn}>
          Desfazer minha última marca
        </Button>
        {control.canClear ? (
          <Button variant="ghost" onClick={() => void control.clear()}>
            Limpar anotações de todos
          </Button>
        ) : null}
      </GlassPopoverContent>
    </Popover.Root>
  );
}
