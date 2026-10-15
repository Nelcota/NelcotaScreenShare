import { Ban, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useOperation } from "@/lib/operations/use-operation";
import { removeParticipantAction } from "@/features/admin/rooms/actions";
import { toastError } from "@/features/admin/shell/ui/toast-error";

type Removal = "kick" | "ban";

const COPY: Record<Removal, { title: string; description: string; confirm: string; done: string }> =
  {
    kick: {
      title: "Remover da chamada?",
      description: "A pessoa sai da chamada agora, mas pode entrar de novo pelo link.",
      confirm: "Remover",
      done: "Pessoa removida da chamada.",
    },
    ban: {
      title: "Banir desta chamada?",
      description: "A pessoa sai agora e só volta quando a chamada terminar.",
      confirm: "Banir",
      done: "Pessoa banida desta chamada.",
    },
  };

/** A ban follows the account; someone without one can come back from a private window. */
const GUEST_BAN_LIMIT = "Como entrou sem conta, pode voltar por uma janela anônima.";

/** Kick or ban someone who is in the room now (live.kick). */
export function RemoveParticipant({
  participationId,
  name,
  guest,
}: {
  participationId: string;
  name: string;
  /** Joined without an account: the ban cannot follow them. */
  guest: boolean;
}) {
  const [dialog, setDialog] = useState<Removal | null>(null);
  const remove = useOperation(removeParticipantAction, {
    onSuccess: () => {
      if (dialog) toast.success(COPY[dialog].done);
      setDialog(null);
    },
    onError: toastError("Não foi possível remover agora."),
  });
  const copy = dialog ? COPY[dialog] : COPY.kick;
  const description =
    dialog === "ban" && guest ? `${copy.description} ${GUEST_BAN_LIMIT}` : copy.description;
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Remover ${name} da chamada`}
        onClick={() => setDialog("kick")}
      >
        <UserX aria-hidden="true" />
        Remover
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Banir ${name} desta chamada`}
        onClick={() => setDialog("ban")}
      >
        <Ban aria-hidden="true" />
        Banir
      </Button>
      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={copy.title}
        description={description}
        confirmLabel={copy.confirm}
        danger
        pending={remove.isPending}
        onConfirm={() => {
          if (dialog) remove.execute({ participationId, action: dialog });
        }}
      />
    </div>
  );
}
