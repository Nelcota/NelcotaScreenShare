import type { OperationHandlers } from "@/server/operations/dispatch.server";
import { hostCommandAction } from "@/features/room/actions.server";
import {
  revokeMySession,
  revokeMyOtherSessions,
  deleteMyAccount,
} from "@/features/account/actions.server";
import { revokeOwnSession, revokeOtherOwnSessions } from "@/features/admin/account/actions.server";
import {
  blockParticipantsAction,
  unblockParticipantsAction,
  deleteParticipantsAction,
  restoreParticipantsAction,
  revokeParticipantSessionsAction,
  resendVerificationAction,
  anonymizeParticipantAction,
} from "@/features/admin/participants/actions.server";
import {
  deleteRoomsAction,
  restoreRoomsAction,
  updateRoomNoteAction,
  createInviteAction,
  revokeInviteAction,
} from "@/features/admin/rooms/actions.server";
import { searchPanelAction } from "@/features/admin/search/actions.server";
import { saveMascotSettings } from "@/features/admin/settings/actions.server";
import { acceptInvitation } from "@/features/auth/actions.server";

/**
 * Everything the browser can call through `/api/operations/:id`. The id follows
 * `<feature>-<name>` and matches the descriptor in each `actions.ts`.
 */
export const operations: OperationHandlers = {
  "room-hostCommandAction": hostCommandAction,
  "account-revokeMySession": revokeMySession,
  "account-revokeMyOtherSessions": revokeMyOtherSessions,
  "account-deleteMyAccount": deleteMyAccount,
  "admin-account-revokeOwnSession": revokeOwnSession,
  "admin-account-revokeOtherOwnSessions": revokeOtherOwnSessions,
  "admin-participants-blockParticipantsAction": blockParticipantsAction,
  "admin-participants-unblockParticipantsAction": unblockParticipantsAction,
  "admin-participants-deleteParticipantsAction": deleteParticipantsAction,
  "admin-participants-restoreParticipantsAction": restoreParticipantsAction,
  "admin-participants-revokeParticipantSessionsAction": revokeParticipantSessionsAction,
  "admin-participants-resendVerificationAction": resendVerificationAction,
  "admin-participants-anonymizeParticipantAction": anonymizeParticipantAction,
  "admin-rooms-deleteRoomsAction": deleteRoomsAction,
  "admin-rooms-restoreRoomsAction": restoreRoomsAction,
  "admin-rooms-updateRoomNoteAction": updateRoomNoteAction,
  "admin-rooms-createInviteAction": createInviteAction,
  "admin-rooms-revokeInviteAction": revokeInviteAction,
  "admin-search-searchPanelAction": searchPanelAction,
  "admin-settings-saveMascotSettings": saveMascotSettings,
  "auth-acceptInvitation": acceptInvitation,
};
export const readOperations = new Set(["admin-search-searchPanelAction"]);
