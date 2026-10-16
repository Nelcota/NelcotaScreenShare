import { useLocalParticipant } from "@livekit/components-react";
import { Flag } from "lucide-react";
import { useState } from "react";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { ReportDialog } from "@/features/reports/ui/ReportDialog";
import { CardMenuItem } from "./CardMenuItem";

/** "Denunciar" on someone's card; only people with an account can report. */
export function CardReportButton({ userId, name }: { userId: string; name: string }) {
  const { localParticipant } = useLocalParticipant();
  const [open, setOpen] = useState(false);
  if (isGuestIdentity(localParticipant.identity)) return null;
  return (
    <>
      <CardMenuItem icon={<Flag />} onClick={() => setOpen(true)}>
        Denunciar
      </CardMenuItem>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        target={{ kind: "user", userId }}
        title={`Denunciar ${name}`}
      />
    </>
  );
}
