import { workspaceRooms } from "@/features/rooms/server/queries.server";
import { myTeams } from "@/features/team/server/queries.server";
import type { DbExecutor } from "@/server/db/index.server";
import { ActionError } from "@/server/operations/action-error";

export type WorkspaceColumn =
  | { tab: "amigos" }
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

/** The column's list for the open tab; an account kept out of the workspace sees none. */
export async function workspaceColumn(
  db: DbExecutor,
  actor: string,
  pathname: string,
): Promise<WorkspaceColumn> {
  const tab = columnTabOf(pathname);
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
