import { LogOut, UserCheck, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  deactivateAdminAction,
  endAdminSessionsAction,
  reactivateAdminAction,
  revokeAdminInvitationAction,
} from "@/features/admin/team/actions";
import type { PendingInvitation, TeamMember } from "@/features/admin/team/server/queries.server";
import { toastError } from "@/features/admin/shell/ui/toast-error";
import { ADMIN_ROLE_LABELS } from "@/features/auth/domain/roles";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useOperation } from "@/lib/operations/use-operation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MemberDialog = "end" | "deactivate" | "reactivate" | null;

const REASON = { label: "Motivo (fica no histórico)", maxLength: 300 };

/** End sessions, deactivate or reactivate one person, each with a reason. */
function MemberActions({ member }: { member: TeamMember }) {
  const [dialog, setDialog] = useState<MemberDialog>(null);
  const close = () => setDialog(null);
  const end = useOperation(endAdminSessionsAction, {
    onSuccess: () => {
      close();
      toast.success("Sessões encerradas.");
    },
    onError: toastError("Não foi possível encerrar as sessões."),
  });
  const deactivate = useOperation(deactivateAdminAction, {
    onSuccess: () => {
      close();
      toast.success("Acesso desativado.");
    },
    onError: toastError("Não foi possível desativar."),
  });
  const reactivate = useOperation(reactivateAdminAction, {
    onSuccess: () => {
      close();
      toast.success("Acesso reativado.");
    },
    onError: toastError("Não foi possível reativar."),
  });
  const openChange = (kind: MemberDialog) => (open: boolean) => setDialog(open ? kind : null);

  return (
    <div className="flex justify-end gap-1">
      {member.active ? (
        <>
          <Button variant="ghost" size="sm" onClick={() => setDialog("end")}>
            <LogOut aria-hidden="true" />
            Encerrar sessões
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDialog("deactivate")}>
            <UserMinus aria-hidden="true" />
            Desativar
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setDialog("reactivate")}>
          <UserCheck aria-hidden="true" />
          Reativar
        </Button>
      )}
      <ConfirmDialog
        open={dialog === "end"}
        onOpenChange={openChange("end")}
        title={`Encerrar as sessões de ${member.name}?`}
        description="A pessoa sai do painel em todos os aparelhos e entra de novo com senha e 2FA."
        confirmLabel="Encerrar"
        pending={end.isPending}
        reason={REASON}
        onConfirm={(reason) => end.execute({ id: member.id, reason })}
      />
      <ConfirmDialog
        open={dialog === "deactivate"}
        onOpenChange={openChange("deactivate")}
        title={`Desativar ${member.name}?`}
        description="A pessoa sai do painel agora e só volta se for reativada."
        confirmLabel="Desativar"
        danger
        pending={deactivate.isPending}
        reason={REASON}
        onConfirm={(reason) => deactivate.execute({ id: member.id, reason })}
      />
      <ConfirmDialog
        open={dialog === "reactivate"}
        onOpenChange={openChange("reactivate")}
        title={`Reativar ${member.name}?`}
        description="A pessoa volta a entrar no painel com a senha e o 2FA que já tinha."
        confirmLabel="Reativar"
        pending={reactivate.isPending}
        reason={REASON}
        onConfirm={(reason) => reactivate.execute({ id: member.id, reason })}
      />
    </div>
  );
}

function LastSeen({ member }: { member: TeamMember }) {
  if (!member.active) return <StatusBadge tone="neutral">Desativado</StatusBadge>;
  if (!member.lastSeenAt) return <>—</>;
  return <span title={formatDateTime(member.lastSeenAt)}>{formatRelative(member.lastSeenAt)}</span>;
}

function MemberRow({ member, you }: { member: TeamMember; you: boolean }) {
  // Nobody changes their own account or an owner here.
  const changeable = !you && member.role !== "owner";
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <div className="font-medium">
          {member.name}
          {you ? <span className="font-normal text-ink-muted"> · você</span> : null}
        </div>
        <div className="text-ink-muted">{member.email}</div>
      </TableCell>
      <TableCell className="whitespace-normal">{ADMIN_ROLE_LABELS[member.role]}</TableCell>
      <TableCell className="whitespace-normal">
        <StatusBadge tone={member.twoFactor ? "success" : "warning"}>
          {member.twoFactor ? "Ativo" : "Desligado"}
        </StatusBadge>
      </TableCell>
      <TableCell>
        <LastSeen member={member} />
      </TableCell>
      <TableCell className="pl-4">
        {changeable ? <MemberActions member={member} /> : null}
      </TableCell>
    </TableRow>
  );
}

/** Everyone with panel access. */
export function TeamTable({ members, youId }: { members: TeamMember[]; youId: string }) {
  return (
    <Section title="Pessoas">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <MemberRow key={member.id} member={member} you={member.id === youId} />
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

function InvitationRow({ invitation }: { invitation: PendingInvitation }) {
  const revoke = useOperation(revokeAdminInvitationAction, {
    onSuccess: () => toast.success("Convite revogado."),
    onError: toastError("Não foi possível revogar."),
  });
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span>
        <span className="font-medium">{invitation.email}</span>
        <span className="text-ink-muted" title={formatDateTime(invitation.expiresAt)}>
          {" "}
          · {ADMIN_ROLE_LABELS[invitation.role]} · vence {formatRelative(invitation.expiresAt)}
        </span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={revoke.isPending}
        onClick={() => revoke.execute({ id: invitation.id })}
      >
        Revogar
      </Button>
    </li>
  );
}

/** Invitations not accepted yet; hidden when there are none. */
export function PendingInvitations({ invitations }: { invitations: PendingInvitation[] }) {
  if (invitations.length === 0) return null;
  return (
    <Section title="Convites pendentes">
      <ul className="flex flex-col divide-y divide-line text-sm">
        {invitations.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} />
        ))}
      </ul>
    </Section>
  );
}
