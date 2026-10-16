import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const sendTestMailAction = operation<
  Parameters<typeof server.sendTestMailAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.sendTestMailAction>>["data"]>
>("admin-mail-sendTestMailAction");
