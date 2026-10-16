import { Copy, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteAdminAction } from "@/features/admin/team/actions";
import { toastError } from "@/features/admin/shell/ui/toast-error";
import { copyText } from "@/lib/clipboard";
import { useOperation } from "@/lib/operations/use-operation";
import { formText } from "@/lib/utils";

const ROLES = [
  { value: "viewer", label: "Leitor", hint: "Vê o painel, sem mudar nada." },
  { value: "admin", label: "Administrador", hint: "Bloqueia contas, cuida de salas e denúncias." },
] as const;

type InvitedRole = (typeof ROLES)[number]["value"];

function isInvitedRole(value: string): value is InvitedRole {
  return ROLES.some((role) => role.value === value);
}

async function copyInvitation(link: string) {
  await copyText(link, {
    context: "Could not copy the panel invitation",
    success: "Link copiado.",
    failure: "Não deu para copiar. Selecione e copie o link.",
  });
}

function InvitationLink({ link, onClose }: { link: string; onClose: () => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Convite criado</DialogTitle>
        <DialogDescription>Copie o link agora. Ele não aparece de novo.</DialogDescription>
      </DialogHeader>
      <div className="flex gap-2">
        <Label htmlFor={id} className="sr-only">
          Link do convite
        </Label>
        <Input id={id} readOnly value={link} onFocus={(event) => event.target.select()} />
        <Button type="button" onClick={() => void copyInvitation(link)}>
          <Copy aria-hidden="true" />
          Copiar
        </Button>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </DialogFooter>
    </div>
  );
}

/** "Convidar": e-mail and role; the link lasts 48 h and is shown once. */
export function InviteAdminDialog() {
  const emailId = useId();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const invite = useOperation(inviteAdminAction, {
    onSuccess: ({ data }) => setLink(data.link),
    onError: toastError("Não foi possível convidar."),
  });
  const close = (next: boolean) => {
    if (!next) setLink(null);
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <Button onClick={() => setOpen(true)}>
        <UserPlus aria-hidden="true" />
        Convidar
      </Button>
      <DialogContent>
        {link ? (
          <InvitationLink link={link} onClose={() => close(false)} />
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const role = formText(data, "role");
              if (!isInvitedRole(role)) return;
              invite.execute({ email: formText(data, "email"), role });
            }}
          >
            <DialogHeader>
              <DialogTitle>Convidar para o painel</DialogTitle>
              <DialogDescription>O link vale por 48 horas e só aparece uma vez.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor={emailId}>E-mail</Label>
              <Input id={emailId} name="email" type="email" autoComplete="off" required />
            </div>
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-2 font-medium">Papel</legend>
              {ROLES.map((role, index) => (
                <div key={role.value} className="flex items-start gap-2">
                  <input
                    id={`${emailId}-${role.value}`}
                    type="radio"
                    name="role"
                    value={role.value}
                    defaultChecked={index === 0}
                    className="mt-1"
                  />
                  <Label
                    htmlFor={`${emailId}-${role.value}`}
                    className="flex flex-col items-start gap-0"
                  >
                    <span className="font-medium">{role.label}</span>
                    <span className="font-normal text-ink-muted">{role.hint}</span>
                  </Label>
                </div>
              ))}
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                Criar convite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
