import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";

export const hostCommandAction = operation<
  Parameters<typeof server.hostCommandAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.hostCommandAction>>["data"]>
>("room-hostCommandAction");
