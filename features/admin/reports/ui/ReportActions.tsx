import { Ban, CheckCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  blockReportedAccountAction,
  deleteReportedMessageAction,
  resolveReportAction,
} from "@/features/admin/reports/actions";
import { toastError } from "@/features/admin/shell/ui/toast-error";
import { useOperation } from "@/lib/operations/use-operation";

type Dialog = "delete" | "block" | null;

/** What a moderator can do with an open report; each one closes it and is audited. */
export function ReportActions({
  id,
  canDeleteMessage,
  canBlock,
}: {
  id: string;
  canDeleteMessage: boolean;
  canBlock: boolean;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const resolve = useOperation(resolveReportAction, {
    onSuccess: () => toast.success("Denúncia resolvida."),
    onError: toastError("Não foi possível resolver."),
  });
  const remove = useOperation(deleteReportedMessageAction, {
    onSuccess: () => {
      close();
      toast.success("Mensagem apagada.");
    },
    onError: toastError("Não foi possível apagar a mensagem."),
  });
  const block = useOperation(blockReportedAccountAction, {
    onSuccess: () => {
      close();
      toast.success("Conta bloqueada.");
    },
    onError: toastError("Não foi possível bloquear."),
  });
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={resolve.isPending}
        onClick={() => resolve.execute({ id })}
      >
        <CheckCheck aria-hidden="true" />
        Resolver sem ação
      </Button>
      {canDeleteMessage ? (
        <Button variant="outline" onClick={() => setDialog("delete")}>
          <Trash2 aria-hidden="true" />
          Apagar mensagem
        </Button>
      ) : null}
      {canBlock ? (
        <Button variant="destructive" onClick={() => setDialog("block")}>
          <Ban aria-hidden="true" />
          Bloquear conta
        </Button>
      ) : null}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title="Apagar esta mensagem?"
        description="Ela some da conversa para todos. Não dá para desfazer."
        confirmLabel="Apagar"
        danger
        pending={remove.isPending}
        onConfirm={() => remove.execute({ id })}
      />
      <ConfirmDialog
        open={dialog === "block"}
        onOpenChange={(open) => setDialog(open ? "block" : null)}
        title="Bloquear esta conta?"
        description="A pessoa sai de todas as sessões e não entra mais até ser desbloqueada."
        confirmLabel="Bloquear"
        danger
        pending={block.isPending}
        reason={{ label: "Motivo", maxLength: 300 }}
        onConfirm={(reason) => block.execute({ id, reason })}
      />
    </div>
  );
}
