import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { closeGhostRoomAction } from "@/features/admin/live/actions";
import { toastError } from "@/features/admin/shell/ui/toast-error";
import { useOperation } from "@/lib/operations/use-operation";

/** Ends a room that LiveKit no longer has; asks first and the server checks again. */
export function CloseGhostButton({ id, code }: { id: string; code: string }) {
  const [open, setOpen] = useState(false);
  const close = useOperation(closeGhostRoomAction, {
    onSuccess: ({ data }) => {
      setOpen(false);
      toast.success(`Sala ${data.code} encerrada no painel.`);
    },
    onError: toastError("Não foi possível fechar a sala."),
  });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Fechar sala fantasma
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Fechar a sala ${code}?`}
        description="Ela já foi encerrada no LiveKit e continua aberta só no painel."
        confirmLabel="Fechar sala"
        pending={close.isPending}
        onConfirm={() => close.execute({ id })}
      />
    </>
  );
}
