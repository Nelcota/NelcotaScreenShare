import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { offerNotifications } from "@/features/notifications/client/permission-offer";
import { useToggleLink } from "@/features/friends/hooks/use-app-panel";
import {
  conversationTitle,
  messagePreview,
  type ConversationItem,
} from "@/features/messages/domain/conversation-display";
import { listTime } from "@/features/messages/domain/timeline";
import { ConversationAvatar } from "@/features/messages/ui/ConversationAvatar";
import {
  NewConversationDialog,
  type PickableFriend,
} from "@/features/messages/ui/NewConversationDialog";
import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils";

/** Accents and case do not matter in the search. */
function searchable(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-xs font-semibold text-canvas">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ConversationRow({
  conversation,
  selfId,
  now,
}: {
  conversation: ConversationItem;
  selfId: string;
  now: Date;
}) {
  const path = `/mensagens/${conversation.id}`;
  const toggle = useToggleLink(path);
  const last = conversation.lastMessage;
  const unread = conversation.unread > 0;
  return (
    <li>
      <NavLink
        viewTransition
        to={path}
        onClick={toggle.onClick}
        className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand aria-[current=page]:bg-surface-3"
      >
        <ConversationAvatar conversation={conversation} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                unread ? "font-bold" : "font-semibold",
              )}
            >
              {conversationTitle(conversation)}
            </span>
            {last ? (
              <span className="shrink-0 text-xs text-ink-subtle">
                {listTime(last.createdAt, now)}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs",
                unread ? "text-ink" : "text-ink-muted",
              )}
            >
              {last ? messagePreview(last, conversation.kind, selfId) : "Sem mensagens ainda"}
            </span>
            <UnreadBadge count={conversation.unread} />
          </span>
        </span>
      </NavLink>
    </li>
  );
}

/** The Mensagens tab: search, "Nova conversa" and the conversations, newest first. */
export function ConversationList({
  conversations,
  friends,
  selfId,
}: {
  conversations: ConversationItem[];
  friends: PickableFriend[];
  selfId: string;
}) {
  const [query, setQuery] = useState("");
  // Opening Mensagens is a good moment to offer notifications, with the tab in front.
  useEffect(() => offerNotifications(), []);
  const wanted = searchable(query.trim());
  const shown = wanted
    ? conversations.filter((item) => searchable(conversationTitle(item)).includes(wanted))
    : conversations;
  const now = useNow();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mt-3 flex items-center gap-2 px-3">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 focus-within:border-brand-soft">
          <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <span className="sr-only">Buscar conversa</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar conversa"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
          />
        </label>
        <NewConversationDialog friends={friends} />
      </div>
      <nav aria-label="Conversas" className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-3">
        {shown.length === 0 ? (
          <p className="px-3 py-4 text-sm text-ink-muted">
            {conversations.length === 0
              ? "Nenhuma conversa ainda."
              : "Nenhuma conversa com esse nome."}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {shown.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selfId={selfId}
                now={now}
              />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
