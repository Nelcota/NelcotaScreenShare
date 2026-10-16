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

/** The rail's width (w-16). */
const RAIL_WIDTH = 64;

const GLIDE =
  "motion-safe:data-gliding:transition-[width] motion-safe:data-gliding:duration-(--motion-layout) motion-safe:data-gliding:ease-(--ease-out-smooth)";

/** A little over --motion-layout (450 ms). */
const GLIDE_MAX_MS = 600;

/** The new content fades in while the width glides. */
const CONTENT =
  "animate-in fade-in-0 duration-(--motion-surface) ease-(--ease-out-smooth) motion-reduce:animate-none";

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

  // The width only glides when the column opens or closes; dragging the edge stays immediate.
  const [gliding, setGliding] = useState(false);
  const toggle = () => {
    setGliding(true);
    // No transitionend when nothing moves (reduced motion, a hidden column): stop anyway.
    window.setTimeout(() => setGliding(false), GLIDE_MAX_MS);
    commit({ ...layout, collapsed: !layout.collapsed });
  };
  useShortcut(COLUMN_SHORTCUT, toggle);

  const content = layout.collapsed ? (
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
  ) : (
    <>
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
    </>
  );

  return (
    <>
      <aside
        aria-label="Amigos"
        data-gliding={gliding || undefined}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget) setGliding(false);
        }}
        className={cn(ASIDE, GLIDE)}
        style={{ width: layout.collapsed ? RAIL_WIDTH : layout.width }}
      >
        {/* Laid out at its final width, so the column is revealed instead of squeezed. */}
        <div
          key={layout.collapsed ? "rail" : "column"}
          className={cn("flex min-h-0 flex-1 flex-col", gliding && CONTENT)}
          style={{ minWidth: layout.collapsed ? RAIL_WIDTH : layout.width }}
        >
          {content}
        </div>
      </aside>
      {layout.collapsed ? (
        <span aria-hidden="true" className="hidden w-3 shrink-0 sm:block" />
      ) : (
        <ColumnResizeHandle
          width={layout.width}
          onChange={(width) => setLayout({ ...layout, width })}
          onCommit={(width) => commit({ ...layout, width })}
        />
      )}
    </>
  );
}
