import { redirect } from "react-router";
import { z } from "zod";
import { requireUser } from "@/features/auth/server/participant-session.server";
import { canMessage, openDirect } from "@/features/messages/server/conversations.server";
import { getDb } from "@/server/db/index.server";
import { routeLoader } from "@/server/route-loader.server";

/** A friend in the column opens the conversation with them, created the first time. */
export const loader = routeLoader(async ({ params }) => {
  const friendId = z.uuid().safeParse(params.id);
  const current = await requireUser(`/amigos/${params.id ?? ""}/conversa`);
  if (!friendId.success) throw redirect("/amigos");
  const conversationId = await getDb().transaction(async (tx) => {
    if (!(await canMessage(tx, current.user.id, friendId.data))) return null;
    return openDirect(tx, current.user.id, friendId.data);
  });
  if (!conversationId) throw redirect(`/amigos/${friendId.data}`);
  throw redirect(`/mensagens/${conversationId}`);
});
