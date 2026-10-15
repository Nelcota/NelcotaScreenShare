import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { RoomAccess } from "@/features/room/domain/room-access";
import type { DbExecutor } from "@/server/db/index.server";
import { roomRoles, roomSettings, users } from "@/server/db/schema";

interface StaffMember {
  id: string;
  name: string;
}

/** Who runs a room created with "Criar sala": owner, moderators and how people get in. */
export interface RoomStaff {
  owner: StaffMember | null;
  moderators: StaffMember[];
  access: RoomAccess;
}

async function rolesIn(db: DbExecutor, codes: string[]) {
  return db
    .select({
      roomCode: roomRoles.roomCode,
      role: roomRoles.role,
      id: users.id,
      name: users.name,
    })
    .from(roomRoles)
    .innerJoin(users, eq(users.id, roomRoles.userId))
    .where(and(inArray(roomRoles.roomCode, codes), isNull(users.deletedAt)))
    .orderBy(asc(roomRoles.createdAt));
}

async function accessIn(db: DbExecutor, codes: string[]) {
  return db
    .select({ roomCode: roomSettings.roomCode, access: roomSettings.access })
    .from(roomSettings)
    .where(inArray(roomSettings.roomCode, codes));
}

/**
 * Staff of each room by code. Rooms nobody created (joined straight by the link) have no
 * owner or moderators and are left out of the map.
 */
export async function staffByRoom(
  db: DbExecutor,
  codes: string[],
): Promise<ReadonlyMap<string, RoomStaff>> {
  if (codes.length === 0) return new Map();
  const [roles, settings] = await Promise.all([rolesIn(db, codes), accessIn(db, codes)]);
  const accessOf = new Map(settings.map((setting) => [setting.roomCode, setting.access]));
  const staff = new Map<string, RoomStaff>();
  for (const { roomCode, role, id, name } of roles) {
    const current = staff.get(roomCode) ?? {
      owner: null,
      moderators: [],
      access: accessOf.get(roomCode) ?? "open",
    };
    staff.set(
      roomCode,
      role === "owner"
        ? { ...current, owner: { id, name } }
        : { ...current, moderators: [...current.moderators, { id, name }] },
    );
  }
  return staff;
}
