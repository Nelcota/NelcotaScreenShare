import { roomWorkspaceAction } from "@/features/rooms/actions.server";
import { teamWorkspaceAction } from "@/features/team/actions.server";
import { provisionBetaAction } from "@/features/admin/beta/actions.server";
import type { OperationHandlers } from "@/server/operations/dispatch.server";
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
  disableParticipantTwoFactorAction,
  removeParticipantPhotoAction,
  resetParticipantNameAction,
} from "@/features/admin/participants/actions.server";
import {
  deleteRoomsAction,
  restoreRoomsAction,
  updateRoomNoteAction,
  createInviteAction,
  revokeInviteAction,
  removeParticipantAction,
  readmitParticipantAction,
} from "@/features/admin/rooms/actions.server";
import { closeGhostRoomAction } from "@/features/admin/live/actions.server";
import { sendTestMailAction } from "@/features/admin/mail/actions.server";
import { searchPanelAction } from "@/features/admin/search/actions.server";
import { saveMascotSettings } from "@/features/admin/settings/actions.server";
import { acceptInvitation } from "@/features/auth/actions.server";
import {
  sendFriendRequest,
  answerFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  friendRelation,
} from "@/features/friends/actions.server";
import {
  answerJoin,
  createRoomAction,
  hostCommandAction,
  joinRequests,
  roomAccess,
  setRoomAccess,
} from "@/features/room/actions.server";
import { addFriend, newFriendCode } from "@/features/friends/code-actions.server";
import { setPresenceStatus } from "@/features/friends/status-actions.server";

/**
 * Everything the browser can call through `/api/operations/:id`. The id follows
 * `<feature>-<name>` and matches the descriptor in each `actions.ts`.
 */
export const operations: OperationHandlers = {
  "rooms-roomWorkspaceAction": roomWorkspaceAction,
  "team-teamWorkspaceAction": teamWorkspaceAction,
  "admin-beta-provisionBetaAction": provisionBetaAction,
  "room-hostCommandAction": hostCommandAction,
  "account-revokeMySession": revokeMySession,
  "account-revokeMyOtherSessions": revokeMyOtherSessions,
  "account-deleteMyAccount": deleteMyAccount,
  "admin-account-revokeOwnSession": revokeOwnSession,
  "admin-account-revokeOtherOwnSessions": revokeOtherOwnSessions,
  "admin-live-closeGhostRoomAction": closeGhostRoomAction,
  "admin-participants-blockParticipantsAction": blockParticipantsAction,
  "admin-participants-unblockParticipantsAction": unblockParticipantsAction,
  "admin-participants-deleteParticipantsAction": deleteParticipantsAction,
  "admin-participants-restoreParticipantsAction": restoreParticipantsAction,
  "admin-participants-revokeParticipantSessionsAction": revokeParticipantSessionsAction,
  "admin-participants-resendVerificationAction": resendVerificationAction,
  "admin-participants-anonymizeParticipantAction": anonymizeParticipantAction,
  "admin-participants-disableParticipantTwoFactorAction": disableParticipantTwoFactorAction,
  "admin-participants-removeParticipantPhotoAction": removeParticipantPhotoAction,
  "admin-participants-resetParticipantNameAction": resetParticipantNameAction,
  "admin-rooms-deleteRoomsAction": deleteRoomsAction,
  "admin-rooms-restoreRoomsAction": restoreRoomsAction,
  "admin-rooms-updateRoomNoteAction": updateRoomNoteAction,
  "admin-rooms-createInviteAction": createInviteAction,
  "admin-rooms-revokeInviteAction": revokeInviteAction,
  "admin-rooms-removeParticipantAction": removeParticipantAction,
  "admin-rooms-readmitParticipantAction": readmitParticipantAction,
  "admin-mail-sendTestMailAction": sendTestMailAction,
  "admin-search-searchPanelAction": searchPanelAction,
  "admin-settings-saveMascotSettings": saveMascotSettings,
  "auth-acceptInvitation": acceptInvitation,
  "room-createRoomAction": createRoomAction,
  "friends-sendFriendRequest": sendFriendRequest,
  "friends-answerFriendRequest": answerFriendRequest,
  "friends-cancelFriendRequest": cancelFriendRequest,
  "friends-removeFriend": removeFriend,
  "friends-blockUser": blockUser,
  "friends-unblockUser": unblockUser,
  "friends-friendRelation": friendRelation,
  "room-roomAccess": roomAccess,
  "room-setRoomAccess": setRoomAccess,
  "room-joinRequests": joinRequests,
  "room-answerJoin": answerJoin,
  "friends-addFriend": addFriend,
  "friends-newFriendCode": newFriendCode,
  "friends-setPresenceStatus": setPresenceStatus,
};
export const readOperations = new Set([
  "admin-search-searchPanelAction",
  "friends-friendRelation",
  "room-roomAccess",
  "room-joinRequests",
]);
