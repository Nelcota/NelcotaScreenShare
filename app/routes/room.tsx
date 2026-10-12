import { routeLoader } from "@/server/route-loader.server";

import { AdmissionError } from "@/features/room/server/session-store.server";
import {
  definitionByCode,
  assertDefinitionAdmission,
} from "@/features/rooms/server/room-access.server";
import { redirect } from "@/server/http.server";
import { getUserSession, requireUser } from "@/features/auth/server/participant-session.server";
import { getAdminSession } from "@/features/auth/server/admin-session.server";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { presenceForGuests } from "@/features/room/domain/presence";
import { roomPresence } from "@/features/room/server/presence.server";
import { decodeRoomParam, roomCodeSchema, roomLink } from "@/features/room/domain/room-code";
import { INVITE_TOKEN_PATTERN } from "@/features/room/domain/invite-token";
import type { RoomEntry } from "@/features/room/ui/ActiveRoom";

export const meta = () => [{ title: "Sala · Nelcota" }];

export const loader = routeLoader(async ({ params, searchParams }) => {
  const codigo = params.codigo ?? "";
  // Panel invite (?convite=…): format checked here, validity in /api/token.
  const { convite } = searchParams;
  const invite =
    typeof convite === "string" && INVITE_TOKEN_PATTERN.test(convite) ? convite : undefined;

  const raw = decodeRoomParam(codigo);
  if (raw === undefined) redirect("/?erro=codigo");
  const code = roomCodeSchema.safeParse(raw);
  if (!code.success) redirect("/?erro=codigo");
  // A single address per room: "/sala/ABC-..." becomes "/sala/abc-...", same as the copied link.
  if (code.data !== raw) redirect(roomLink(code.data, invite));

  // Without an account the person joins as a guest. An account still needs a confirmed
  // e-mail (when required); after confirming, it comes back here.
  const current = await getUserSession();
  const user = current ? (await requireUser(roomLink(code.data, invite))).user : null;
  const { ACCESS_PASSWORD, MAX_PARTICIPANTS } = getEnv();
  const passwordRequired = ACCESS_PASSWORD !== undefined;
  const { unavailable, permanent } = await roomUnavailable(code.data, user?.id);
  // Who is already inside, for the pre-join screen to show.
  const [roomNow, admin] = await Promise.all([
    unavailable ? Promise.resolve(null) : roomPresence(getDb(), code.data),
    getAdminSession(),
  ]);
  const presence = roomNow ? presenceForGuests(roomNow, passwordRequired || user === null) : null;

  return {
    unavailable,
    permanent,
    invite,
    code: code.data,
    user: user && { name: user.name, image: user.image },
    passwordRequired,
    maxParticipants: MAX_PARTICIPANTS,
    presence,
    // Admin session in this browser: the call offers the panel without leaving the room.
    isAdmin: admin !== null,
  } satisfies RoomEntry;
});

/**
 * The session is drawn by `ActiveRoom` in the root, from this page's data: a call
 * keeps going while the person visits other pages (the admin panel).
 */
export default function RoomPage() {
  return null;
}

async function roomUnavailable(code: string, identity: string | undefined) {
  const definition = await definitionByCode(getDb(), code);
  if (!definition) return { unavailable: undefined, permanent: false };
  try {
    await assertDefinitionAdmission(getDb(), definition, identity ?? "convidado-prejoin", false);
    return { unavailable: undefined, permanent: definition.kind !== "ad_hoc" };
  } catch (error) {
    if (!(error instanceof AdmissionError)) throw error;
    return { unavailable: error.message, permanent: definition.kind !== "ad_hoc" };
  }
}
