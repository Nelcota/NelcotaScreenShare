import { useState, type ReactNode } from "react";
import { saveColumnLayout } from "@/features/friends/client/column-layout-cookie";
import { COLUMN_SHORTCUT, type ColumnLayout } from "@/features/friends/domain/column-layout";
import type { FriendsSidebarData } from "@/features/friends/server/friends-sidebar.server";
import { ColumnResizeHandle } from "@/features/friends/ui/ColumnResizeHandle";
import {
  FriendsColumn,
  type ColumnExtras,
  type ColumnTab,
} from "@/features/friends/ui/FriendsColumn";
import { FriendsRail } from "@/features/friends/ui/FriendsRail";
import { StatusStrip } from "@/features/friends/ui/StatusStrip";
import { useShortcut } from "@/lib/hooks/use-shortcut";
import { cn } from "@/lib/utils";

const ASIDE = "glass hidden shrink-0 flex-col overflow-hidden rounded-3xl sm:flex";

/**
 * The friends column on the left of every signed-in page: open with a width you drag, or
 * collapsed into a rail. Both stay in this browser. Phones use the bottom tabs instead.
 */
export function FriendsSidebar({
  data,
  tabs,
  activeTab,
  tabContent,
  extras,
}: {
  data: FriendsSidebarData;
  tabs: ColumnTab[];
  activeTab: string;
  /** The list of a tab other than Amigos (Salas, Times); none shows the friends. */
  tabContent?: ReactNode;
  /** "Criar grupo" and "Grupos", from the messages, composed by the page. */
  extras?: Omit<ColumnExtras, "unreadByFriend">;
}) {
  const [layout, setLayout] = useState<ColumnLayout>(data.columnLayout);

  function commit(next: ColumnLayout) {
    setLayout(next);
    saveColumnLayout(next);
  }

  const toggle = () => commit({ ...layout, collapsed: !layout.collapsed });
  useShortcut(COLUMN_SHORTCUT, toggle);

  if (layout.collapsed) {
    return (
      <>
        <aside aria-label="Amigos" className={cn(ASIDE, "w-16")}>
          <FriendsRail
            friends={data.friends}
            unreadByFriend={data.unreadByFriend}
            requests={data.requests}
            code={data.code}
            linkPath={data.linkPath}
            account={data.account}
            ownStatus={data.ownStatus}
            onExpand={toggle}
          />
        </aside>
        <span aria-hidden="true" className="hidden w-3 shrink-0 sm:block" />
      </>
    );
  }

  return (
    <>
      <aside aria-label="Amigos" className={ASIDE} style={{ width: layout.width }}>
        <FriendsColumn
          tabs={tabs}
          activeTab={activeTab}
          friends={data.friends}
          extras={{ ...extras, unreadByFriend: data.unreadByFriend }}
          requests={data.requests}
          code={data.code}
          linkPath={data.linkPath}
          onCollapse={toggle}
        >
          {tabContent}
        </FriendsColumn>
        <StatusStrip account={data.account} status={data.ownStatus} />
      </aside>
      <ColumnResizeHandle
        width={layout.width}
        onChange={(width) => setLayout({ ...layout, width })}
        onCommit={(width) => commit({ ...layout, width })}
      />
    </>
  );
}
