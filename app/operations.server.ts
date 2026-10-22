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
import { saveMailSenderAction, sendTestMailAction } from "@/features/admin/mail/actions.server";
import {
  blockReportedAccountAction,
  deleteReportedMessageAction,
  resolveReportAction,
} from "@/features/admin/reports/actions.server";
import { searchPanelAction } from "@/features/admin/search/actions.server";
import {
  deactivateAdminAction,
  endAdminSessionsAction,
  inviteAdminAction,
  reactivateAdminAction,
  revokeAdminInvitationAction,
} from "@/features/admin/team/actions.server";
import { saveMascotSettings } from "@/features/admin/settings/actions.server";
import { acceptInvitation } from "@/features/auth/actions.server";
import { reportAction } from "@/features/reports/actions.server";
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
import {
  openDirectConversation,
  createGroupConversation,
  sendMessage,
  listMessages,
  listConversations,
  deleteMessage,
  markConversationRead,
  leaveGroup,
} from "@/features/messages/actions.server";
import {
  favoriteGif,
  unfavoriteGif,
  listGifFavorites,
} from "@/features/messages/gif-actions.server";
import {
  attachmentDownload,
  confirmAttachment,
  requestAttachmentUpload,
} from "@/features/messages/attachment-actions.server";
import { addFriend, newFriendCode } from "@/features/friends/code-actions.server";
import { setPresenceStatus } from "@/features/friends/status-actions.server";
import {
  acceptCall,
  callFriend,
  callGroup,
  cancelCall,
  declineCall,
} from "@/features/ringing/actions.server";

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
  "admin-mail-saveMailSenderAction": saveMailSenderAction,
  "admin-reports-resolveReportAction": resolveReportAction,
  "admin-reports-deleteReportedMessageAction": deleteReportedMessageAction,
  "admin-reports-blockReportedAccountAction": blockReportedAccountAction,
  "admin-search-searchPanelAction": searchPanelAction,
  "admin-team-inviteAdminAction": inviteAdminAction,
  "admin-team-revokeAdminInvitationAction": revokeAdminInvitationAction,
  "admin-team-deactivateAdminAction": deactivateAdminAction,
  "admin-team-reactivateAdminAction": reactivateAdminAction,
  "admin-team-endAdminSessionsAction": endAdminSessionsAction,
  "admin-settings-saveMascotSettings": saveMascotSettings,
  "auth-acceptInvitation": acceptInvitation,
  "reports-reportAction": reportAction,
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
  "messages-openDirectConversation": openDirectConversation,
  "messages-createGroupConversation": createGroupConversation,
  "messages-sendMessage": sendMessage,
  "messages-listMessages": listMessages,
  "messages-listConversations": listConversations,
  "messages-deleteMessage": deleteMessage,
  "messages-markConversationRead": markConversationRead,
  "messages-leaveGroup": leaveGroup,
  "messages-favoriteGif": favoriteGif,
  "messages-unfavoriteGif": unfavoriteGif,
  "messages-requestAttachmentUpload": requestAttachmentUpload,
  "messages-confirmAttachment": confirmAttachment,
  "messages-attachmentDownload": attachmentDownload,
  "messages-listGifFavorites": listGifFavorites,
  "friends-addFriend": addFriend,
  "friends-newFriendCode": newFriendCode,
  "friends-setPresenceStatus": setPresenceStatus,
  "ringing-callFriend": callFriend,
  "ringing-callGroup": callGroup,
  "ringing-cancelCall": cancelCall,
  "ringing-declineCall": declineCall,
  "ringing-acceptCall": acceptCall,
};
export const readOperations = new Set([
  "friends-friendRelation",
  "room-roomAccess",
  "room-joinRequests",
  "messages-listMessages",
  "messages-listConversations",
  "messages-listGifFavorites",
]);
