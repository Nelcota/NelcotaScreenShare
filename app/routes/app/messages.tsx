import { useRouteLoaderData } from "react-router";
import { ConversationList } from "@/features/messages/ui/ConversationList";
import { AppEmptyState } from "./empty-state";
import type { loader as appLoader } from "./layout";

export const meta = () => [
  { title: "Mensagens · Nelcota" },
  { name: "robots", content: "noindex" },
];

/** Phones have no column: the "Mensagens" tab shows the list itself. */
function PhoneConversations() {
  const app = useRouteLoaderData<typeof appLoader>("app");
  if (app?.workspace.tab !== "mensagens") return null;
  return (
    <div className="flex flex-col py-5 sm:hidden">
      <h1 className="px-4 text-2xl font-semibold tracking-tight">Mensagens</h1>
      <ConversationList
        conversations={app.workspace.conversations}
        friends={app.friends}
        selfId={app.selfId}
      />
    </div>
  );
}

/** The messages tab with no conversation open: the app's start, or the list on a phone. */
export default function MessagesTab() {
  return (
    <>
      <PhoneConversations />
      <AppEmptyState className="max-sm:hidden" />
    </>
  );
}
