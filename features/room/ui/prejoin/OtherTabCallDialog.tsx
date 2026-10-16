import { ConfirmDialog } from "@/components/ConfirmDialog";
import { otherTabCallMessage } from "@/features/room/domain/room-switch";
import { useStreamerMode } from "@/features/room/hooks/use-streamer-mode";

/**
 * Asks before joining here while another tab of this browser is in a call (`code`);
 * nothing is shown without one. Confirming makes that tab leave.
 */
export function OtherTabCallDialog({
  code,
  onConfirm,
  onCancel,
}: {
  code: string | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { enabled: streamerMode } = useStreamerMode();
  if (code === undefined) return null;

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title="Entrar nesta aba?"
      description={otherTabCallMessage(code, { hideCodes: streamerMode })}
      confirmLabel="Entrar aqui"
      onConfirm={onConfirm}
    />
  );
}
