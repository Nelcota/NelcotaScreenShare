import { shownStatuses } from "@/features/friends/server/presence-status.server";
import type { ShownStatus } from "@/features/friends/domain/presence-status";
import {
  conversationList,
  type ConversationSummary,
} from "@/features/messages/server/conversation-list.server";
import { workspaceRooms } from "@/features/rooms/server/queries.server";
import { myTeams } from "@/features/team/server/queries.server";
import type { DbExecutor } from "@/server/db/index.server";
import { ActionError } from "@/server/operations/action-error";

type ColumnConversation = ConversationSummary & { status: ShownStatus | null };

export type WorkspaceColumn =
  | { tab: "amigos" }
  | { tab: "mensagens"; conversations: ColumnConversation[] }
  | {
      tab: "salas";
      rooms: {
        id: string;
        name: string;
        detail: string;
        favorite: boolean;
        archived: boolean;
      }[];
    }
  | { tab: "times"; teams: { id: string; name: string }[] };

/** Main's permanent rooms and teams pages show their list in the column, like Amigos. */
export function columnTabOf(pathname: string): WorkspaceColumn["tab"] {
  if (pathname === "/mensagens" || pathname.startsWith("/mensagens/")) return "mensagens";
  if (pathname === "/salas" || pathname.startsWith("/salas/")) return "salas";
  if (pathname === "/times" || pathname.startsWith("/times/")) return "times";
  return "amigos";
}

async function roomItems(db: DbExecutor, actor: string) {
  const [rooms, teams] = await Promise.all([workspaceRooms(db, actor), myTeams(db, actor)]);
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  return rooms.map((room) => {
    const team = room.teamId ? teamNames.get(room.teamId) : undefined;
    return {
      id: room.id,
      name: room.name ?? "Sala sem nome",
      detail: team ? `Sala de time · ${team}` : "Sala pessoal",
      favorite: room.favorite,
      archived: Boolean(room.archivedAt),
    };
  });
}

/** The conversations, with each direct friend's status as the Amigos tab shows it. */
async function conversationItems(db: DbExecutor, actor: string): Promise<ColumnConversation[]> {
  const conversations = await conversationList(db, actor);
  const directIds = conversations.flatMap((item) =>
    item.kind === "direct" && item.others[0] ? [item.others[0].id] : [],
  );
  const statuses = await shownStatuses(db, directIds);
  return conversations.map((item) => {
    const other = item.kind === "direct" ? item.others[0] : undefined;
    return { ...item, status: other ? (statuses.get(other.id) ?? "offline") : null };
  });
}

/** The column's list for the open tab; an account kept out of the workspace sees none. */
export async function workspaceColumn(
  db: DbExecutor,
  actor: string,
  pathname: string,
): Promise<WorkspaceColumn> {
  const tab = columnTabOf(pathname);
  if (tab === "mensagens") return { tab, conversations: await conversationItems(db, actor) };
  try {
    if (tab === "salas") return { tab, rooms: await roomItems(db, actor) };
    if (tab === "times") return { tab, teams: await myTeams(db, actor) };
    return { tab };
  } catch (error) {
    if (!(error instanceof ActionError)) throw error;
    if (tab === "salas") return { tab, rooms: [] };
    if (tab === "times") return { tab, teams: [] };
    return { tab };
  }
}
