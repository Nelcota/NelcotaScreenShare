import type { FriendsSidebarData } from "@/features/friends/server/friends-sidebar.server";
import { FriendsSidebar } from "@/features/friends/ui/FriendsSidebar";
import {
  useMessageNotifications,
  type LatestUnread,
} from "@/features/messages/hooks/use-message-notifications";
import { columnTabs } from "./column-parts";

/** What the room page loads for the friends column (signed in only). */
export interface RoomColumnData {
  sidebar: FriendsSidebarData;
  requests: number;
  unread: number;
  /** The newest unread message, so a message still gets its notice during a call. */
  latestUnread: LatestUnread | null;
}

/**
 * The app's friends column on the room's screens. In the call it starts as the rail, leaving
 * the room the space; opening it is the person's choice, saved like everywhere else.
 */
export function RoomColumn({ column, inCall }: { column: RoomColumnData; inCall: boolean }) {
  useMessageNotifications(column.latestUnread);
  const layout = inCall
    ? { ...column.sidebar.columnLayout, collapsed: true }
    : column.sidebar.columnLayout;
  return (
    <FriendsSidebar
      data={{ ...column.sidebar, columnLayout: layout }}
      tabs={columnTabs({ requests: column.requests, unread: column.unread })}
      activeTab="amigos"
    />
  );
}
