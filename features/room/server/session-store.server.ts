import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { roomDefinitions, roomSessions, roomSessionMembers } from "@/server/db/schema/room-control";
import { users } from "@/server/db/schema/user-auth";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { admissionRefusal } from "@/features/room/domain/host-controls";
import { ActionError } from "@/server/operations/action-error";
import { z } from "zod";

export type ControlSession = typeof roomSessions.$inferSelect;

export class AdmissionError extends ActionError {
  constructor(
    public readonly code:
      | "room_closed"
      | "room_removed"
      | "room_locked"
      | "room_full"
      | "host_absent",
    message: string,
  ) {
    super(message);
  }
}

const REFUSAL_MESSAGES = {
  room_closed: "Esta sala foi encerrada pelo anfitrião. Crie uma nova sala para continuar.",
  room_removed: "Você não está mais nesta chamada. Você pode voltar quando ela terminar.",
  room_locked: "O anfitrião bloqueou novas entradas nesta sala.",
} as const;

/** All authority/admission operations serialize on the public room code. */
export async function lockControlRoom(tx: DbExecutor, code: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`nelcota:control:${code}`}, 0))`,
  );
}

export async function openControlSession(tx: DbExecutor, code: string) {
  const [row] = await tx
    .select({ session: roomSessions })
    .from(roomSessions)
    .innerJoin(roomDefinitions, eq(roomDefinitions.id, roomSessions.definitionId))
    .where(and(eq(roomDefinitions.code, code), ne(roomSessions.status, "closed")))
    .limit(1);
  return row?.session;
}

export async function sessionByMediaName(tx: DbExecutor, mediaName: string) {
  const [row] = await tx
    .select({
      session: roomSessions,
      code: roomDefinitions.code,
      definitionClosed: roomDefinitions.closedAt,
      definition: roomDefinitions,
    })
    .from(roomSessions)
    .innerJoin(roomDefinitions, eq(roomDefinitions.id, roomSessions.definitionId))
    .where(eq(roomSessions.mediaRoomName, mediaName))
    .limit(1);
  return row;
}

export async function memberInSession(tx: DbExecutor, sessionId: string, identity: string) {
  const [member] = await tx
    .select()
    .from(roomSessionMembers)
    .where(
      and(eq(roomSessionMembers.sessionId, sessionId), eq(roomSessionMembers.identity, identity)),
    );
  return member;
}

export function assertAdmission(
  session: ControlSession,
  member: Awaited<ReturnType<typeof memberInSession>>,
  definitionClosed = false,
) {
  const code = admissionRefusal({
    closed: session.status === "closed" || definitionClosed,
    excluded: member?.excludedAt != null,
    locked: session.admissionLocked,
    admitted: member?.admittedAt != null,
  });
  if (code) throw new AdmissionError(code, REFUSAL_MESSAGES[code]);
}

export async function activeAccount(tx: DbExecutor, identity: string) {
  if (isGuestIdentity(identity) || !z.uuid().safeParse(identity).success) return undefined;
  const [account] = await tx
    .select({
      id: users.id,
      name: users.name,
      blockedAt: users.blockedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, identity))
    .limit(1);
  if (!account || account.blockedAt || account.deletedAt) return undefined;
  return account;
}

/**
 * The LiveKit room of a public code: the code itself until host controls are enabled, then
 * the open session's media name (the code while no call is open).
 */
export async function mediaRoomIn(tx: DbExecutor, code: string): Promise<string> {
  if (!getEnv().ROOM_HOST_CONTROLS_ENABLED) return code;
  return (await openControlSession(tx, code))?.mediaRoomName ?? code;
}

/** Legacy calls keep their existing media name until host controls are enabled. */
export async function mediaRoomForCode(code: string): Promise<string> {
  return mediaRoomIn(getDb(), code);
}

/** The public code behind a LiveKit room name; a name that is no session's is the code. */
export async function roomCodeForMedia(tx: DbExecutor, mediaName: string): Promise<string> {
  // Not behind the flag: sessions recorded while it was on keep their names.
  return (await sessionByMediaName(tx, mediaName))?.code ?? mediaName;
}

/** Public codes behind several LiveKit room names, in one read; unknown names are codes. */
export async function roomCodesForMedia(tx: DbExecutor, mediaNames: readonly string[]) {
  if (mediaNames.length === 0) return [];
  const sessions = await tx
    .select({ mediaName: roomSessions.mediaRoomName, code: roomDefinitions.code })
    .from(roomSessions)
    .innerJoin(roomDefinitions, eq(roomDefinitions.id, roomSessions.definitionId))
    .where(inArray(roomSessions.mediaRoomName, [...mediaNames]));
  const codeOf = new Map(sessions.map((session) => [session.mediaName, session.code]));
  return mediaNames.map((name) => codeOf.get(name) ?? name);
}
