import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reportAction } from "@/features/reports/actions";
import {
  REASON_LABELS,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  type ReportReason,
} from "@/features/reports/domain/reports";
import { useOperation } from "@/lib/operations/use-operation";

type ReportTargetInput = Parameters<typeof reportAction>[0]["target"];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ReportTargetInput;
  /** "Denunciar Ana", "Denunciar mensagem"… */
  title: string;
}

/**
 * Report a person, a message or a group. Used by the person's card in the call and by
 * the messages screens. The reported person never learns who reported.
 */
export function ReportDialog({ open, onOpenChange, target, title }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const detailsId = useId();
  const report = useOperation(reportAction, {
    onSuccess: () => {
      onOpenChange(false);
      setReason(null);
      setDetails("");
      toast.success("Denúncia enviada.");
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Não foi possível enviar agora."),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason || report.isPending) return;
            report.execute({ target, reason, details: details.trim() || undefined });
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>A pessoa não fica sabendo quem denunciou.</DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Motivo</legend>
            {REPORT_REASONS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="motivo"
                  value={option}
                  checked={reason === option}
                  onChange={() => setReason(option)}
                  className="size-4 accent-brand"
                />
                {REASON_LABELS[option]}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={detailsId}>Detalhes</Label>
            <Textarea
              id={detailsId}
              value={details}
              maxLength={REPORT_DETAILS_MAX}
              onChange={(event) => setDetails(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={report.isPending} disabled={!reason}>
              Enviar denúncia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
