import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const resolveReportAction = operation<
  Parameters<typeof server.resolveReportAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.resolveReportAction>>["data"]>
>("admin-reports-resolveReportAction");
export const deleteReportedMessageAction = operation<
  Parameters<typeof server.deleteReportedMessageAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.deleteReportedMessageAction>>["data"]>
>("admin-reports-deleteReportedMessageAction");
export const blockReportedAccountAction = operation<
  Parameters<typeof server.blockReportedAccountAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.blockReportedAccountAction>>["data"]>
>("admin-reports-blockReportedAccountAction");
