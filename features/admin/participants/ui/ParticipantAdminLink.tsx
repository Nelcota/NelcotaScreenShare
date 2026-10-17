import { useId, useState } from "react";
import { toast } from "sonner";
import { Section } from "@/components/Section";
import { Switch } from "@/components/ui/switch";
import { setAdminLinkAction } from "@/features/admin/participants/admin-link-actions";
import { toastError } from "@/features/admin/shell/ui/toast-error";
import { useOperation } from "@/lib/operations/use-operation";

/** Owner only: whether this account shows "Abrir o painel" in its Configurações. */
export function ParticipantAdminLink({ id, initial }: { id: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const labelId = useId();
  const save = useOperation(setAdminLinkAction, {
    onSuccess: ({ data }) => {
      setOn(data.on);
      toast.success(data.on ? "Link do painel ligado." : "Link do painel desligado.");
    },
    onError: toastError("Não foi possível mudar o link do painel."),
  });
  return (
    <Section title="Painel admin">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span id={labelId} className="text-sm font-medium">
            Link do painel em Configurações
          </span>
          <span className="text-sm text-ink-muted">
            A pessoa ainda entra com o login do painel e o código.
          </span>
        </div>
        <Switch
          checked={on}
          disabled={save.isPending}
          onCheckedChange={(checked) => save.execute({ id, on: checked })}
          aria-labelledby={labelId}
        />
      </div>
    </Section>
  );
}
