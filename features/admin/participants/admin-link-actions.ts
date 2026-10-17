import { operation } from "@/lib/operations/operation";
import type * as server from "./admin-link-actions.server";
export const setAdminLinkAction = operation<
  Parameters<typeof server.setAdminLinkAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.setAdminLinkAction>>["data"]>
>("admin-participants-setAdminLinkAction");
