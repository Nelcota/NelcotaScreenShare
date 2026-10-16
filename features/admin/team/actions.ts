import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const inviteAdminAction = operation<
  Parameters<typeof server.inviteAdminAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.inviteAdminAction>>["data"]>
>("admin-team-inviteAdminAction");
export const revokeAdminInvitationAction = operation<
  Parameters<typeof server.revokeAdminInvitationAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.revokeAdminInvitationAction>>["data"]>
>("admin-team-revokeAdminInvitationAction");
export const deactivateAdminAction = operation<
  Parameters<typeof server.deactivateAdminAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.deactivateAdminAction>>["data"]>
>("admin-team-deactivateAdminAction");
export const reactivateAdminAction = operation<
  Parameters<typeof server.reactivateAdminAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.reactivateAdminAction>>["data"]>
>("admin-team-reactivateAdminAction");
export const endAdminSessionsAction = operation<
  Parameters<typeof server.endAdminSessionsAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.endAdminSessionsAction>>["data"]>
>("admin-team-endAdminSessionsAction");
