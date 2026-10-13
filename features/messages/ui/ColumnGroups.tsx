import { NavLink } from "react-router";
import { UnreadCount } from "@/components/UnreadCount";
import { conversationTitle } from "@/features/messages/domain/conversation-display";
import type { ColumnGroup } from "@/features/messages/server/conversation-list.server";
import { ConversationAvatar } from "@/features/messages/ui/ConversationAvatar";

function unreadLabel(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? ", 1 mensagem nova" : `, ${count} mensagens novas`;
}

function GroupLine({ group }: { group: ColumnGroup }) {
  const title = conversationTitle(group);
  return (
    <li className="rounded-2xl transition-colors hover:bg-surface-3 has-[a[aria-current=page]]:bg-surface-3">
      <NavLink
        viewTransition
        to={`/mensagens/${group.id}`}
        aria-label={`${title}${unreadLabel(group.unread)}`}
        className="flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="relative shrink-0">
          <ConversationAvatar conversation={{ ...group, status: null }} />
          <UnreadCount count={group.unread} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="block text-xs text-ink-muted">{group.others.length + 1} pessoas</span>
        </span>
      </NavLink>
    </li>
  );
}

/** "Grupos" above the friends, only for whoever is in one. */
export function ColumnGroups({ groups }: { groups: readonly ColumnGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section aria-label="Grupos" className="pb-1">
      <h2 className="px-2 pt-3 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        Grupos
      </h2>
      <ul className="mt-1 flex flex-col gap-0.5">
        {groups.map((group) => (
          <GroupLine key={group.id} group={group} />
        ))}
      </ul>
    </section>
  );
}
