import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const deleteRoomsAction = operation<
  Parameters<typeof server.deleteRoomsAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.deleteRoomsAction>>["data"]>
>("admin-rooms-deleteRoomsAction");
export const restoreRoomsAction = operation<
  Parameters<typeof server.restoreRoomsAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.restoreRoomsAction>>["data"]>
>("admin-rooms-restoreRoomsAction");
export const updateRoomNoteAction = operation<
  Parameters<typeof server.updateRoomNoteAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.updateRoomNoteAction>>["data"]>
>("admin-rooms-updateRoomNoteAction");
export const createInviteAction = operation<
  Parameters<typeof server.createInviteAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.createInviteAction>>["data"]>
>("admin-rooms-createInviteAction");
export const revokeInviteAction = operation<
  Parameters<typeof server.revokeInviteAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.revokeInviteAction>>["data"]>
>("admin-rooms-revokeInviteAction");
export const removeParticipantAction = operation<
  Parameters<typeof server.removeParticipantAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.removeParticipantAction>>["data"]>
>("admin-rooms-removeParticipantAction");
export const readmitParticipantAction = operation<
  Parameters<typeof server.readmitParticipantAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.readmitParticipantAction>>["data"]>
>("admin-rooms-readmitParticipantAction");
