import { routeLoader } from "@/server/route-loader.server";

import { isRouteErrorResponse, useRouteError } from "react-router";
import { notFound, redirect } from "@/server/http.server";
import { ErrorScreen } from "@/components/shell/ErrorScreen";
import { Mascot } from "@/features/mascot/ui/Mascot";
import { AdmissionError } from "@/features/room/server/session-store.server";
import {
  definitionByCode,
  assertDefinitionAdmission,
} from "@/features/rooms/server/room-access.server";
import { getUserSession, requireUser } from "@/features/auth/server/participant-session.server";
import { offersPanelShortcut } from "@/features/auth/server/panel-shortcut.server";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { presenceForGuests } from "@/features/room/domain/presence";
import { roomPresence } from "@/features/room/server/presence.server";
import { roomExists } from "@/features/room/server/room-codes.server";
import { awaitsApproval } from "@/features/room/server/room-access.server";
import { liveKitGateway } from "@/features/room/server/livekit-gateway.server";
import { visitorBannedFromCall } from "@/features/room/server/room-bans.server";
import { RoomUnavailable } from "@/features/room/ui/RoomUnavailable";
import { roomTitle } from "@/features/room/domain/room-title";
import { roomOwnerName } from "@/features/room/server/role-changes.server";
import { decodeRoomParam, roomCodeSchema, roomLink } from "@/features/room/domain/room-code";
import { INVITE_TOKEN_PATTERN } from "@/features/room/domain/invite-token";
import type { RoomEntry } from "@/features/room/ui/ActiveRoom";
import { friendsSidebarData } from "@/features/friends/server/friends-sidebar.server";
import { unreadSummary } from "@/features/messages/server/conversation-list.server";
import { skipClientOnlyChanges } from "@/app/revalidation";

export const meta = () => [{ title: "Sala · Nelcota" }];

/** The room code from the address; an invalid one goes home, and casing is normalized. */
function canonicalRoomCode(codigo: string, invite: string | undefined): string {
  const raw = decodeRoomParam(codigo);
  if (raw === undefined) redirect("/?erro=codigo");
  const parsed = roomCodeSchema.safeParse(raw);
  if (!parsed.success) redirect("/?erro=codigo");
  // A single address per room: "/sala/ABC-..." becomes "/sala/abc-...", same as the copied link.
  if (parsed.data !== raw) redirect(roomLink(parsed.data, invite));
  return parsed.data;
}

/** The room filter and ?atendeu are read in the browser: changing them reloads nothing. */
export const shouldRevalidate = skipClientOnlyChanges;

export const loader = routeLoader(async ({ params, searchParams, request }) => {
  const codigo = params.codigo ?? "";
  // Panel invite (?convite=…): format checked here, validity in /api/token.
  const { convite } = searchParams;
  const invite =
    typeof convite === "string" && INVITE_TOKEN_PATTERN.test(convite) ? convite : undefined;

  const code = canonicalRoomCode(codigo, invite);
  // Only rooms created through "Criar sala" open.
  if (!(await roomExists(getDb(), code))) notFound();

  // Without an account the person joins as a guest. An account still needs a confirmed
  // e-mail (when required); after confirming, it comes back here.
  const current = await getUserSession();
  const user = current ? (await requireUser(roomLink(code, invite))).user : null;
  // Banned from the call happening now: the page says so instead of offering to join.
  const banned = await visitorBannedFromCall(getDb(), liveKitGateway, {
    roomCode: code,
    userId: user?.id,
    request,
  });
  if (banned) throw new Response(null, { status: 403 });
  const { ACCESS_PASSWORD, MAX_PARTICIPANTS } = getEnv();
  const passwordRequired = ACCESS_PASSWORD !== undefined;
  const definition = await definitionByCode(getDb(), code);
  const { unavailable, permanent } = await roomUnavailable(definition, user?.id);
  // Who is already inside, for the pre-join screen to show.
  // Hidden without an account, behind the password, or until someone is let in.
  const [roomNow, panelShortcut, ownerName, waiting] = await Promise.all([
    unavailable ? Promise.resolve(null) : roomPresence(getDb(), code),
    offersPanelShortcut(user),
    roomOwnerName(getDb(), code),
    user ? awaitsApproval(getDb(), code, user.id) : true,
  ]);
  const presence = roomNow ? presenceForGuests(roomNow, passwordRequired || waiting) : null;

  const entry = {
    unavailable,
    permanent,
    invite,
    code: code,
    user: user && { name: user.name, image: user.image },
    passwordRequired,
    maxParticipants: MAX_PARTICIPANTS,
    roomName: roomTitle(definition, ownerName),
    presence,
    // Someone on the team: the call offers the panel without leaving the room.
    panelShortcut,
  } satisfies RoomEntry;
  // Signed in, the friends column comes along, as on every page of the app.
  return { ...entry, column: user ? await roomColumn(user, request) : null };
});

async function roomColumn(
  user: { id: string; name: string; image?: string | null },
  request: Request,
) {
  const db = getDb();
  const [sidebar, unread] = await Promise.all([
    friendsSidebarData(db, user, request),
    unreadSummary(db, user.id),
  ]);
  return {
    sidebar,
    requests: sidebar.requests,
    unread: unread.total,
    latestUnread: unread.latest,
  };
}

/**
 * The session is drawn by `ActiveRoom` in the root, from this page's data: a call
 * keeps going while the person visits other pages (the admin panel).
 */
export default function RoomPage() {
  return null;
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404)
    return <RoomUnavailable reason="missing" />;
  if (isRouteErrorResponse(error) && error.status === 403)
    return <RoomUnavailable reason="banned" />;
  return (
    <ErrorScreen
      missing={false}
      mascot={<Mascot className="size-32" sizes="384px" expression="surprised" canSleep={false} />}
    />
  );
}

async function roomUnavailable(
  definition: Awaited<ReturnType<typeof definitionByCode>>,
  identity: string | undefined,
) {
  if (!definition) return { unavailable: undefined, permanent: false };
  try {
    await assertDefinitionAdmission(getDb(), definition, identity ?? "convidado-prejoin", false);
    return { unavailable: undefined, permanent: definition.kind !== "ad_hoc" };
  } catch (error) {
    if (!(error instanceof AdmissionError)) throw error;
    return { unavailable: error.message, permanent: definition.kind !== "ad_hoc" };
  }
}
