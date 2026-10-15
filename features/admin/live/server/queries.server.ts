import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { staffByRoom, type RoomStaff } from "@/features/admin/rooms/server/room-staff.server";
import type { RoomAccess } from "@/features/room/domain/room-access";
import type { DbExecutor } from "@/server/db/index.server";
import { roomParticipations, rooms, shareSessions, users } from "@/server/db/schema";

const ROOMS_SHOWN = 100;

interface LivePerson {
  id: string;
  name: string;
  userId: string | null;
  joinedAt: Date;
}

export interface LiveRoom {
  id: string;
  code: string;
  startedAt: Date;
  lastActivityAt: Date;
  /** Only whether someone is sharing: never who, what or the content. */
  sharing: boolean;
  people: LivePerson[];
  /** Only for rooms created with "Criar sala": the owner's name and how people get in. */
  staff: { owner: string | null; access: RoomAccess } | null;
}

async function peopleIn(db: DbExecutor, roomIds: string[]) {
  if (roomIds.length === 0) return [];
  return db
    .select({
      id: roomParticipations.id,
      roomId: roomParticipations.roomId,
      name: sql<string>`coalesce(${roomParticipations.displayName}, ${users.name}, 'Sem nome')`,
      userId: roomParticipations.userId,
      joinedAt: roomParticipations.joinedAt,
    })
    .from(roomParticipations)
    .leftJoin(users, eq(users.id, roomParticipations.userId))
    .where(and(inArray(roomParticipations.roomId, roomIds), isNull(roomParticipations.leftAt)))
    .orderBy(asc(roomParticipations.joinedAt));
}

async function roomsSharing(db: DbExecutor, roomIds: string[]): Promise<Set<string>> {
  if (roomIds.length === 0) return new Set();
  const sharing = await db
    .selectDistinct({ roomId: shareSessions.roomId })
    .from(shareSessions)
    .where(and(inArray(shareSessions.roomId, roomIds), isNull(shareSessions.endedAt)));
  return new Set(sharing.map((share) => share.roomId));
}

function liveStaff(staff: RoomStaff | undefined): LiveRoom["staff"] {
  if (!staff) return null;
  return { owner: staff.owner?.name ?? null, access: staff.access };
}

/** "Who and when" of every live room: the room, the people in it and since when. */
export async function listLiveRooms(db: DbExecutor): Promise<LiveRoom[]> {
  const live = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      startedAt: rooms.startedAt,
      lastActivityAt: rooms.lastActivityAt,
    })
    .from(rooms)
    .where(and(eq(rooms.status, "active"), isNull(rooms.deletedAt)))
    .orderBy(desc(rooms.startedAt), desc(rooms.id))
    .limit(ROOMS_SHOWN);

  const ids = live.map((room) => room.id);
  const [people, sharing, staff] = await Promise.all([
    peopleIn(db, ids),
    roomsSharing(db, ids),
    staffByRoom(
      db,
      live.map((room) => room.code),
    ),
  ]);
  return live.map((room) => ({
    ...room,
    sharing: sharing.has(room.id),
    staff: liveStaff(staff.get(room.code)),
    people: people
      .filter((person) => person.roomId === room.id)
      .map(({ id, name, userId, joinedAt }) => ({ id, name, userId, joinedAt })),
  }));
}
