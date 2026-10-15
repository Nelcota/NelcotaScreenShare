import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOperation } from "@/lib/operations/use-operation";
import { readmitParticipantAction } from "@/features/admin/rooms/actions";
import { toastError } from "@/features/admin/shell/ui/toast-error";

/** "Deixar voltar": lifts the ban from this call (live.kick). */
export function ReadmitButton({
  roomId,
  identity,
  name,
}: {
  roomId: string;
  identity: string;
  name: string;
}) {
  const readmit = useOperation(readmitParticipantAction, {
    onSuccess: () => toast.success(`${name} pode voltar para a chamada.`),
    onError: toastError("Não foi possível liberar agora."),
  });
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={`Deixar ${name} voltar para a chamada`}
      disabled={readmit.isPending}
      onClick={() => readmit.execute({ roomId, identity })}
    >
      Deixar voltar
    </Button>
  );
}
