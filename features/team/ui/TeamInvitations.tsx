import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { copyWorkspaceLink } from "@/components/workspace/RoomCard";
import { formText } from "@/lib/utils";
import type { TeamCommand } from "../domain/commands";

export function TeamInvitations({
  teamId,
  invitations,
  link,
  active,
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
  pending: boolean;
  onCommand: (command: TeamCommand) => void;
}) {
  const id = useId();
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-xl font-semibold">Convites</h2>
      <p className="text-sm text-ink-muted">
        Crie e compartilhe o link com o destinatário. Ele expira em 7 dias, vale uma vez e exige uma
        conta com este e-mail confirmado.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onCommand({
            kind: "invite",
            teamId,
            email: formText(data, "email"),
            role: data.get("role") === "manager" ? "manager" : "member",
          });
        }}
      >
        <Label htmlFor={id}>E-mail da pessoa</Label>
        <Input id={id} name="email" type="email" required maxLength={254} disabled={!active} />
        <Label htmlFor={`${id}-role`}>Função no time</Label>
        <select
          id={`${id}-role`}
          name="role"
          className="rounded-xl border border-line bg-surface-2 p-3"
          disabled={!active}
        >
          <option value="member">Membro</option>
          <option value="manager">Gestor</option>
        </select>
        <Button disabled={pending || !active} type="submit">
          Gerar convite
        </Button>
      </form>
      {link ? (
        <output className="flex flex-col gap-3 rounded-xl border border-brand/30 bg-brand/10 p-4">
          <p className="text-sm">
            Convite criado. Copie agora; o link completo só aparece nesta resposta.
          </p>
          <Input value={link} readOnly aria-label="Link do convite" />
          <Button variant="outline" onClick={() => void copyWorkspaceLink(link)}>
            Copiar convite
          </Button>
        </output>
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
  return `Válido até ${new Date(invite.expiresAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
}
