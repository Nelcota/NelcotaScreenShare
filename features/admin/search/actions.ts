import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const searchPanelAction = operation<
  Parameters<typeof server.searchPanelAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.searchPanelAction>>["data"]>
>("admin-search-searchPanelAction", "post", { mutates: false });
