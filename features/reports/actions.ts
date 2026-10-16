import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const reportAction = operation<
  Parameters<typeof server.reportAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.reportAction>>["data"]>
>("reports-reportAction");
