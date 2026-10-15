import { useId, useState } from "react";
import { ChoiceSelect } from "@/components/ChoiceSelect";
import { Field } from "@/components/Field";
import { FormError } from "@/components/FormError";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EMAIL_PATTERN } from "@/features/auth/domain/sign-up";
import { copyWorkspaceLink } from "@/components/workspace/RoomCard";
import { formText } from "@/lib/utils";
import type { TeamCommand } from "../domain/commands";
import { Notice } from "@/components/Notice";
import { TIME_ZONE } from "@/lib/format";

const ROLE_OPTIONS = [
  { value: "member", label: "Membro" },
  { value: "manager", label: "Gestor" },
] as const;

export function TeamInvitations({
  teamId,
  invitations,
  link,
  active,
  canInviteManagers,
  pending,
  onCommand,
}: {
  teamId: string;
  invitations: {
    id: string;
    email: string;
    role: "manager" | "member";
    expiresAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
  }[];
  link?: string;
  active: boolean;
  /** Only the owner decides who manages the team; a manager invites members. */
  canInviteManagers: boolean;
  pending: boolean;
  onCommand: (command: TeamCommand) => void;
}) {
  const id = useId();
  const [emailError, setEmailError] = useState<string>();
  return (
    <section className="panel flex flex-col gap-4 rounded-2xl p-5">
      <h2 className="text-xl font-semibold">Convites</h2>
      <p className="text-sm text-ink-muted">
        Crie e compartilhe o link com o destinatário. Ele expira em 7 dias, vale uma vez e exige uma
        conta com este e-mail confirmado.
      </p>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const email = formText(data, "email").trim();
          if (!EMAIL_PATTERN.test(email)) return setEmailError("Digite um e-mail válido.");
          setEmailError(undefined);
          onCommand({
            kind: "invite",
            teamId,
            email,
            role: data.get("role") === "manager" ? "manager" : "member",
          });
        }}
      >
        <Field
          id={id}
          label="E-mail da pessoa"
          footer={<FormError id={`${id}-error`} message={emailError} />}
        >
          <Input
            name="email"
            type="email"
            required
            maxLength={254}
            disabled={!active}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? `${id}-error` : undefined}
            onChange={() => setEmailError(undefined)}
          />
        </Field>
        {canInviteManagers ? (
          <Field id={`${id}-role`} label="Função no time">
            <ChoiceSelect
              id={`${id}-role`}
              name="role"
              className="h-11 w-full bg-surface-2"
              options={ROLE_OPTIONS}
              disabled={!active}
            />
          </Field>
        ) : null}
        <Button disabled={pending || !active} type="submit">
          Gerar convite
        </Button>
      </form>
      {link ? (
        <Notice as="output" tone="brand" className="flex-col items-stretch gap-3 p-4">
          <p className="text-sm">
            Convite criado. Copie agora; o link completo só aparece nesta resposta.
          </p>
          <Input value={link} readOnly aria-label="Link do convite" />
          <Button variant="outline" onClick={() => void copyWorkspaceLink(link)}>
            Copiar convite
          </Button>
        </Notice>
      ) : null}
      <ul className="divide-y divide-line">
        {invitations.map((invite) => (
          <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="text-sm break-all">{invite.email}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {invitationStatus(invite)} · {invite.role === "manager" ? "Gestor" : "Membro"}
              </p>
            </div>
            {!invite.usedAt && !invite.revokedAt ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => onCommand({ kind: "revoke", teamId, invitationId: invite.id })}
              >
                Revogar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
function invitationStatus(invite: {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}) {
  if (invite.usedAt) return "Aceito";
  if (invite.revokedAt) return "Revogado";
  // Expiry is enforced by the server; render a stable date for SSR hydration.
  return `Válido até ${new Date(invite.expiresAt).toLocaleDateString("pt-BR", { timeZone: TIME_ZONE })}`;
}
