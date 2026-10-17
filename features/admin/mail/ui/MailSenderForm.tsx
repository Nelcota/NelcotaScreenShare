import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/Field";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveMailSenderAction } from "@/features/admin/mail/actions";
import { MAX_SENDER_LENGTH, mailSenderSchema } from "@/features/admin/mail/domain/sender";
import { toastError } from "@/features/admin/shell/ui/toast-error";
import { useOperation } from "@/lib/operations/use-operation";

function senderHint(hosting: string | null): string {
  const verified = "O domínio precisa estar verificado no provedor.";
  if (!hosting) return verified;
  return `${verified} Vazio usa o da hospedagem: ${hosting}.`;
}

function savedMessage(sender: string | null, hosting: string | null): string {
  if (sender) return "Remetente salvo.";
  if (hosting) return "Voltou a usar o da hospedagem.";
  return "Remetente apagado.";
}

/** Who the e-mails come from (owner only); keys and SMTP stay in the hosting. */
export function MailSenderForm({
  saved,
  hosting,
}: {
  /** The sender saved in the panel, or null when MAIL_FROM applies. */
  saved: string | null;
  /** The hosting's MAIL_FROM, shown as what a blank field falls back to. */
  hosting: string | null;
}) {
  const [value, setValue] = useState(saved ?? "");
  const [error, setError] = useState<string | undefined>(undefined);
  const save = useOperation(saveMailSenderAction, {
    onSuccess: () => toast.success(savedMessage(value.trim() || null, hosting)),
    onError: toastError("Não foi possível salvar o remetente."),
  });
  const changed = value.trim() !== (saved ?? "");
  const submit = () => {
    const parsed = mailSenderSchema.safeParse({ sender: value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    save.execute(parsed.data);
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3 border-t border-line pt-4"
    >
      <Field label="Remetente" hint={senderHint(hosting)}>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Nelcota <no-reply@seudominio.com>"
          maxLength={MAX_SENDER_LENGTH}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
        />
      </Field>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={save.isPending} disabled={!changed}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
