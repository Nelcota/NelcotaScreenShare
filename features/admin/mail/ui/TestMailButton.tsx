import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendTestMailAction } from "@/features/admin/mail/actions";
import { toastError } from "@/features/admin/shell/ui/toast-error";
import { useOperation } from "@/lib/operations/use-operation";

/** Sends a test e-mail to the signed-in admin; the result lands in the list below. */
export function TestMailButton() {
  const send = useOperation(sendTestMailAction, {
    onSuccess: ({ data }) => toast.success(`E-mail de teste enviado para ${data.sentTo}.`),
    onError: toastError("Não foi possível enviar o e-mail de teste."),
  });
  return (
    <Button size="sm" disabled={send.isPending} onClick={() => send.execute({})}>
      <Send aria-hidden="true" />
      Enviar e-mail de teste
    </Button>
  );
}
