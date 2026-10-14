import {
  Ban,
  ImageOff,
  UserPen,
  LockOpen,
  LogOut,
  MailCheck,
  RotateCcw,
  ShieldOff,
  ShieldX,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { ParticipantStatus } from "@/features/admin/participants/domain/search-params";
import { availableActions } from "@/features/admin/participants/domain/available-actions";
import { BLOCK_DESCRIPTION } from "@/features/admin/participants/domain/labels";
import { useParticipantOperations, type ParticipantOperations } from "./use-participant-operations";

type Dialog =
  | "block"
  | "revokeSessions"
  | "delete"
  | "anonymize"
  | "disableTwoFactor"
  | "removePhoto"
  | "resetName"
  | null;

/** The reason goes to the person by e-mail and stays in the audit. */
const NOTICE_REASON = { label: "Motivo (vai no e-mail)", maxLength: 300 };

interface ParticipantSelection {
  kind: "ids";
  ids: string[];
}

function ActionButtons({
  id,
  selection,
  show,
  operations,
  openDialog,
}: {
  id: string;
  selection: ParticipantSelection;
  show: ReturnType<typeof availableActions>;
  operations: ParticipantOperations;
  openDialog: (dialog: Dialog) => void;
}) {
  const { unblock, resend, restore } = operations;
  return (
    <>
      {show.unblock ? (
        <Button
          variant="outline"
          disabled={unblock.isPending}
          onClick={() => unblock.execute({ selection })}
        >
          <LockOpen aria-hidden="true" />
          Desbloquear
        </Button>
      ) : null}
      {show.block ? (
        <Button variant="outline" onClick={() => openDialog("block")}>
          <Ban aria-hidden="true" />
          Bloquear
        </Button>
      ) : null}
      {show.revokeSessions ? (
        <Button variant="outline" onClick={() => openDialog("revokeSessions")}>
          <LogOut aria-hidden="true" />
          Encerrar sessões
        </Button>
      ) : null}
      {show.resendVerification ? (
        <Button
          variant="outline"
          disabled={resend.isPending}
          onClick={() => resend.execute({ id })}
        >
          <MailCheck aria-hidden="true" />
          Reenviar verificação
        </Button>
      ) : null}
      {show.disableTwoFactor ? (
        <Button variant="outline" onClick={() => openDialog("disableTwoFactor")}>
          <ShieldOff aria-hidden="true" />
          Desligar 2FA
        </Button>
      ) : null}
      {show.removePhoto ? (
        <Button variant="outline" onClick={() => openDialog("removePhoto")}>
          <ImageOff aria-hidden="true" />
          Remover foto
        </Button>
      ) : null}
      {show.resetName ? (
        <Button variant="outline" onClick={() => openDialog("resetName")}>
          <UserPen aria-hidden="true" />
          Redefinir nome
        </Button>
      ) : null}
      {show.restore ? (
        <Button
          variant="outline"
          disabled={restore.isPending}
          onClick={() => restore.execute({ ids: [id] })}
        >
          <RotateCcw aria-hidden="true" />
          Restaurar
        </Button>
      ) : null}
      {show.delete ? (
        <Button variant="destructive" onClick={() => openDialog("delete")}>
          <Trash2 aria-hidden="true" />
          Excluir
        </Button>
      ) : null}
      {show.anonymize ? (
        <Button variant="destructive" onClick={() => openDialog("anonymize")}>
          <ShieldX aria-hidden="true" />
          Anonimizar (LGPD)
        </Button>
      ) : null}
    </>
  );
}

function ConfirmDialogs({
  id,
  selection,
  dialog,
  setDialog,
  operations,
}: {
  id: string;
  selection: ParticipantSelection;
  dialog: Dialog;
  setDialog: (dialog: Dialog) => void;
  operations: ParticipantOperations;
}) {
  const { block, revoke, remove, anonymize, disableTwoFactor, removePhoto, resetName } = operations;
  return (
    <>
      <ConfirmDialog
        open={dialog === "block"}
        onOpenChange={(open) => setDialog(open ? "block" : null)}
        title="Bloquear esta conta?"
        description={BLOCK_DESCRIPTION}
        confirmLabel="Bloquear"
        danger
        pending={block.isPending}
        reason={{ label: "Motivo (fica no histórico)", maxLength: 300 }}
        onConfirm={(reason) => block.execute({ selection, reason })}
      />
      <ConfirmDialog
        open={dialog === "revokeSessions"}
        onOpenChange={(open) => setDialog(open ? "revokeSessions" : null)}
        title="Encerrar as sessões desta conta?"
        description="A pessoa sai de todos os aparelhos e precisa entrar de novo."
        confirmLabel="Encerrar"
        pending={revoke.isPending}
        onConfirm={() => revoke.execute({ id })}
      />
      <ConfirmDialog
        open={dialog === "disableTwoFactor"}
        onOpenChange={(open) => setDialog(open ? "disableTwoFactor" : null)}
        title="Desligar o 2FA desta conta?"
        description="A pessoa passa a entrar só com a senha e pode ativar o 2FA de novo. As sessões dela são encerradas."
        confirmLabel="Desligar 2FA"
        danger
        pending={disableTwoFactor.isPending}
        reason={{ label: "Motivo", maxLength: 300 }}
        onConfirm={(reason) => disableTwoFactor.execute({ id, reason })}
      />
      <ConfirmDialog
        open={dialog === "removePhoto"}
        onOpenChange={(open) => setDialog(open ? "removePhoto" : null)}
        title="Remover a foto?"
        description="A foto sai da conta. A pessoa recebe um e-mail com o motivo e pode enviar outra."
        confirmLabel="Remover"
        danger
        pending={removePhoto.isPending}
        reason={NOTICE_REASON}
        onConfirm={(reason) => removePhoto.execute({ id, reason })}
      />
      <ConfirmDialog
        open={dialog === "resetName"}
        onOpenChange={(open) => setDialog(open ? "resetName" : null)}
        title="Redefinir o nome?"
        description="O nome vira Pessoa e 4 números. A pessoa recebe um e-mail com o motivo e pode escolher outro nome depois."
        confirmLabel="Redefinir"
        pending={resetName.isPending}
        reason={NOTICE_REASON}
        onConfirm={(reason) => resetName.execute({ id, reason })}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title="Excluir esta conta?"
        description="A conta some das listas e não entra mais. Dá para desfazer logo depois ou restaurar aqui mesmo."
        confirmLabel="Excluir"
        danger
        pending={remove.isPending}
        onConfirm={() => remove.execute({ selection })}
      />
      <ConfirmDialog
        open={dialog === "anonymize"}
        onOpenChange={(open) => setDialog(open ? "anonymize" : null)}
        title="Anonimizar esta conta?"
        description="Irreversível. Nome e e-mail viram valores sem dados pessoais, senha, 2FA e sessões são apagados e o nome sai do histórico de salas. Os IPs ficam até a retenção de 6 meses (Marco Civil)."
        confirmLabel="Anonimizar para sempre"
        danger
        pending={anonymize.isPending}
        typedConfirmation="ANONIMIZAR"
        onConfirm={() => anonymize.execute({ id, confirmation: "ANONIMIZAR" })}
      />
    </>
  );
}

/** Actions on a participant's detail page, according to status and permissions. */
export function ParticipantActions({
  id,
  status,
  verified,
  anonymized,
  twoFactor,
  photo,
  sessions,
  can,
}: {
  id: string;
  status: ParticipantStatus;
  verified: boolean;
  anonymized: boolean;
  twoFactor: boolean;
  photo: boolean;
  sessions: number;
  can: { update: boolean; delete: boolean; anonymize: boolean; disableTwoFactor: boolean };
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const selection: ParticipantSelection = { kind: "ids", ids: [id] };
  const operations = useParticipantOperations(() => setDialog(null));

  const show = availableActions({
    status,
    verified,
    anonymized,
    twoFactor,
    photo,
    sessions,
    can,
  });
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButtons
        id={id}
        selection={selection}
        show={show}
        operations={operations}
        openDialog={setDialog}
      />
      <ConfirmDialogs
        id={id}
        selection={selection}
        dialog={dialog}
        setDialog={setDialog}
        operations={operations}
      />
    </div>
  );
}
