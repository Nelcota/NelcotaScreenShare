import { useLocalParticipant } from "@livekit/components-react";
import { useState } from "react";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { ReportDialog } from "@/features/reports/ui/ReportDialog";

/** Quiet "Denunciar" on someone's card; only people with an account can report. */
export function CardReportButton({ userId, name }: { userId: string; name: string }) {
  const { localParticipant } = useLocalParticipant();
  const [open, setOpen] = useState(false);
  if (isGuestIdentity(localParticipant.identity)) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-center text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
      >
        Denunciar
      </button>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        target={{ kind: "user", userId }}
        title={`Denunciar ${name}`}
      />
    </>
  );
}
