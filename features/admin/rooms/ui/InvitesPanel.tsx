import { CircleX, Copy, Link2, Plus } from "lucide-react";
import { useOperation } from "@/lib/operations/use-operation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
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
import { ChoiceSelect } from "@/components/ChoiceSelect";
import { FormError } from "@/components/FormError";
import { formatDateTime } from "@/lib/format";
import { formText } from "@/lib/utils";
import { createInviteAction, revokeInviteAction } from "@/features/admin/rooms/actions";
import {
  INVITE_MAX_USES,
  INVITE_VALIDITY,
  inviteMaxUsesSchema,
} from "@/features/admin/rooms/domain/invites";
import { toastError } from "@/features/admin/shell/ui/toast-error";
import { copyText } from "@/lib/clipboard";
import { Field } from "@/components/Field";

export interface InviteRow {
  id: string;
  label: string | null;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: string;
  /** Computed in the database (server clock). */
  state: keyof typeof STATES;
}

const VALIDITY_OPTIONS = [
  { value: "", label: "Sem validade" },
  ...INVITE_VALIDITY.map((option) => ({ value: String(option.hours), label: option.label })),
];

const STATES = {
  active: { label: "Ativo", tone: "success" },
  revoked: { label: "Revogado", tone: "neutral" },
  expired: { label: "Expirado", tone: "neutral" },
  exhausted: { label: "Esgotado", tone: "warning" },
} as const;

async function copyInviteLink(link: string) {
  await copyText(link, {
    context: "Could not copy the invite link",
    success: "Link copiado.",
    failure: "Não deu para copiar. Selecione e copie o link.",
  });
}

function CreateInviteDialog({
  roomId,
  open,
  onOpenChange,
}: {
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ids = { label: useId(), uses: useId(), validity: useId(), link: useId() };
  const [link, setLink] = useState<string | null>(null);
  const [usesError, setUsesError] = useState<string>();
  const create = useOperation(createInviteAction, {
    onSuccess: ({ data }) => setLink(data.link),
    onError: toastError("Confira os campos e tente de novo."),
  });
  const close = (next: boolean) => {
    if (!next) {
      setLink(null);
      setUsesError(undefined);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {link ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Convite criado</DialogTitle>
              <DialogDescription>Copie o link agora. Ele não aparece de novo.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Label htmlFor={ids.link} className="sr-only">
                Link do convite
              </Label>
              <Input
                id={ids.link}
                readOnly
                value={link}
                onFocus={(event) => event.target.select()}
              />
              <Button type="button" onClick={() => void copyInviteLink(link)}>
                <Copy aria-hidden="true" />
                Copiar
              </Button>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => close(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              // Text fields: a File here could only come from a tampered form (formText).
              const field = (name: string) => formText(data, name);
              const uses = field("uses").trim();
              const maxUses = uses ? Number(uses) : null;
              const usesInput =
                event.currentTarget.querySelector<HTMLInputElement>('input[name="uses"]');
              if (usesInput?.validity.badInput || !inviteMaxUsesSchema.safeParse(maxUses).success) {
                setUsesError("Informe um limite inteiro entre 1 e 1.000 pessoas.");
                usesInput?.focus();
                return;
              }
              setUsesError(undefined);
              const validity = field("validity");
              create.execute({
                roomId,
                label: field("label"),
                maxUses,
                validityHours: validity ? Number(validity) : null,
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Novo convite</DialogTitle>
              <DialogDescription>
                Defina validade, limite de pessoas ou os dois. Voltar à sala com o mesmo convite não
                gasta outro uso.
              </DialogDescription>
            </DialogHeader>
            <Field id={ids.label} label="Nome (opcional)">
              <Input name="label" maxLength={80} placeholder="Ex.: Turma de março" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id={ids.uses} label="Limite de pessoas">
                <Input
                  name="uses"
                  type="number"
                  min={1}
                  max={INVITE_MAX_USES}
                  aria-invalid={usesError ? true : undefined}
                  aria-describedby={usesError ? `${ids.uses}-error` : undefined}
                  onChange={() => setUsesError(undefined)}
                  placeholder="Sem limite"
                />
              </Field>
              <Field id={ids.validity} label="Validade">
                <ChoiceSelect
                  id={ids.validity}
                  name="validity"
                  defaultValue="24"
                  className="h-11 w-full bg-surface-2"
                  options={VALIDITY_OPTIONS}
                />
              </Field>
            </div>
            <FormError id={`${ids.uses}-error`} message={usesError} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending}>
                <Link2 aria-hidden="true" />
                Criar convite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Room invites: create (link shown once) and revoke. */
export function InvitesPanel({
  roomId,
  invites,
  can,
}: {
  roomId: string;
  invites: InviteRow[];
  can: { create: boolean; revoke: boolean };
}) {
  const [open, setOpen] = useState(false);
  const revoke = useOperation(revokeInviteAction, {
    onSuccess: () => toast.success("Convite revogado."),
    onError: toastError("Não foi possível revogar."),
  });
  return (
    <div className="flex flex-col gap-3">
      {can.create ? (
        <Button variant="outline" className="w-fit" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          Novo convite
        </Button>
      ) : null}
      {invites.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum convite para esta sala.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {invites.map((invite) => {
            const state = STATES[invite.state];
            return (
              <li key={invite.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 font-medium">
                    {invite.label ?? "Convite sem nome"}
                    <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                  </span>
                  <span className="text-ink-muted">
                    {invite.uses}
                    {invite.maxUses === null ? "" : ` de ${invite.maxUses}`}{" "}
                    {invite.uses === 1 ? "pessoa" : "pessoas"} ·{" "}
                    {invite.expiresAt
                      ? `expira ${formatDateTime(invite.expiresAt)}`
                      : "sem validade"}{" "}
                    · por {invite.createdBy}
                  </span>
                </span>
                {can.revoke && invite.state === "active" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={() => revoke.execute({ id: invite.id })}
                  >
                    <CircleX aria-hidden="true" />
                    Revogar
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {can.create ? (
        <CreateInviteDialog roomId={roomId} open={open} onOpenChange={setOpen} />
      ) : null}
    </div>
  );
}
