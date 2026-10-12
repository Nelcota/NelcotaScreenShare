import { operations, readOperations } from "@/app/operations.server";
import { operationDispatcher } from "@/server/operations/dispatch.server";
import { z } from "zod";

const dispatch = operationDispatcher({
  operations,
  readOperations,
  successRedirects: {
    "auth-acceptInvitation": "/admin/entrar?aviso=convite",
    "account-deleteMyAccount": "/?aviso=conta-excluida",
    "team-teamWorkspaceAction": teamDestination,
  },
});

export const loader = dispatch;
export const action = dispatch;

function teamDestination(data: unknown, input: unknown) {
  const command = z.object({ kind: z.enum(["create", "accept"]) }).safeParse(input);
  const result = z.object({ teamId: z.uuid() }).safeParse(data);
  if (!command.success || !result.success) return undefined;
  return `/times/${result.data.teamId}`;
}
