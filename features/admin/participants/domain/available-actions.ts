import type { ParticipantStatus } from "./search-params";

export interface ParticipantState {
  status: ParticipantStatus;
  verified: boolean;
  anonymized: boolean;
  twoFactor: boolean;
  /** Has a profile photo. */
  photo: boolean;
  /** Sessions open right now. */
  sessions: number;
  can: { update: boolean; delete: boolean; anonymize: boolean; disableTwoFactor: boolean };
}

/** Photo and name moderation: only on a live account. */
function profileActions({ status, anonymized, photo, can }: ParticipantState) {
  const editable = can.update && status !== "excluido" && !anonymized;
  return { removePhoto: editable && photo, resetName: editable };
}

/** Which actions show on the participant detail, by status and permissions. */
export function availableActions(state: ParticipantState) {
  const { status, verified, anonymized, twoFactor, sessions, can } = state;
  const deleted = status === "excluido";
  return {
    unblock: can.update && !deleted && status === "bloqueado",
    block: can.update && !deleted && status !== "bloqueado",
    revokeSessions: can.update && sessions > 0,
    resendVerification: can.update && !verified && !deleted,
    restore: can.delete && deleted && !anonymized,
    delete: can.delete && !deleted,
    anonymize: can.anonymize && !anonymized,
    disableTwoFactor: can.disableTwoFactor && twoFactor && !deleted && !anonymized,
    ...profileActions(state),
  };
}
