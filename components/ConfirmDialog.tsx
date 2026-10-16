import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/Field";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Defaults to "Cancelar". */
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  /** Asks for a text (e.g. the block reason), passed on confirm. */
  reason?: { label: string; placeholder?: string; maxLength: number };
  /** Only enables the button after this word is typed (irreversible actions). */
  typedConfirmation?: string;
  onConfirm: (reason: string) => void;
}

/** Confirmation for a sensitive action, with a reason or a typed word when needed. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  danger,
  pending,
  reason,
  typedConfirmation,
  onConfirm,
}: ConfirmDialogProps) {
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const reasonId = useId();
  const typedId = useId();
  const ready =
    (!reason || text.trim().length >= 3) && (!typedConfirmation || typed === typedConfirmation);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setText("");
          setTyped("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready && !pending) onConfirm(text.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {reason ? (
            <Field id={reasonId} label={<>{reason.label}</>}>
              <Textarea
                value={text}
                maxLength={reason.maxLength}
                placeholder={reason.placeholder}
                onChange={(event) => setText(event.target.value)}
                required
              />
            </Field>
          ) : null}
          {typedConfirmation ? (
            <Field
              id={typedId}
              label={
                <>
                  Digite <strong className="font-sans tabular-nums">{typedConfirmation}</strong>{" "}
                  para confirmar
                </>
              }
            >
              <Input
                value={typed}
                autoComplete="off"
                onChange={(event) => setTyped(event.target.value)}
              />
            </Field>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              variant={danger ? "destructive" : "default"}
              loading={pending}
              disabled={!ready}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
