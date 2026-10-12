import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const provisionBetaAction = operation<
  Parameters<typeof server.provisionBetaAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.provisionBetaAction>>["data"]>
>("admin-beta-provisionBetaAction");
