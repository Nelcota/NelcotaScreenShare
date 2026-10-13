import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData, Link } from "react-router";

import { ArrowLeft } from "lucide-react";
import { notFound } from "@/server/http.server";
import { z } from "zod";
import { Section } from "@/components/Section";
import { InvitesPanel } from "@/features/admin/rooms/ui/InvitesPanel";
import { RoomNoteForm } from "@/features/admin/rooms/ui/RoomNoteForm";
import { RoomStatus } from "@/features/admin/rooms/ui/RoomStatus";
import {
  RoomParticipants,
  RoomRemovals,
  RoomShares,
  RoomStaffSection,
  RoomSummary,
} from "@/features/admin/rooms/ui/RoomDetailSections";
import { AdminHistory } from "@/features/admin/audit/ui/AdminHistory";
import { getRoomDetail } from "@/features/admin/rooms/server/queries.server";
import { removedFromCall } from "@/features/admin/rooms/server/room-removals.server";
import { staffByRoom } from "@/features/admin/rooms/server/room-staff.server";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { getDb } from "@/server/db/index.server";

export const meta = () => [{ title: "Sala · Nelcota" }];

export const loader = routeLoader(async ({ params }) => {
  const admin = await requireAdmin({ room: ["read"] });
  const id = params.id ?? "";
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const detail = await getRoomDetail(db, id);
  if (!detail) notFound();
  const { room, participants, shares, invites, history } = detail;
  const staff = (await staffByRoom(db, [room.code])).get(room.code) ?? null;
  const role = admin.user.role;
  const live = room.status === "active" && room.deletedAt === null;
  const online = participants.filter((participant) => participant.leftAt === null).length;
  // Bans last only while the call does: nothing to list once it is over.
  const removals = live ? await removedFromCall(db, room) : [];

  return {
    room,
    participants,
    shares,
    invites,
    history,
    staff,
    removals,
    live,
    online,
    canUpdate: can(role, { room: ["update"] }),
    // Only while the call is live: removing needs someone connected.
    canRemove: live && can(role, { live: ["kick"] }),
    canInvite: {
      create: can(role, { roomInvite: ["create"] }) && room.deletedAt === null,
      revoke: can(role, { roomInvite: ["revoke"] }),
    },
  };
});

export default function RoomPage() {
  const {
    room,
    participants,
    shares,
    invites,
    history,
    staff,
    removals,
    live,
    online,
    canUpdate,
    canRemove,
    canInvite,
  } = useLoaderData<typeof loader>();
  return (
    <>
      <div className="flex flex-col gap-3">
        <Link
          viewTransition
          to="/admin/salas"
          className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Salas
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-sans text-2xl font-semibold tracking-[-0.025em] tabular-nums">
            {room.code}
          </h1>
          <RoomStatus status={room.status} deleted={room.deletedAt !== null} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RoomSummary room={room} online={live ? online : null} shareCount={shares.length} />
        {staff ? <RoomStaffSection staff={staff} /> : null}
        <Section title="Nota interna" description="Só o painel vê.">
          <RoomNoteForm id={room.id} note={room.note} canEdit={canUpdate} />
        </Section>
      </div>

      <Section
        title="Convites"
        description="Links com validade ou limite de pessoas. Quem entra por um convite não precisa da senha de acesso."
      >
        <InvitesPanel
          roomId={room.id}
          invites={invites.map((invite) => ({
            ...invite,
            expiresAt: invite.expiresAt?.toISOString() ?? null,
            revokedAt: invite.revokedAt?.toISOString() ?? null,
            createdAt: invite.createdAt.toISOString(),
          }))}
          can={canInvite}
        />
      </Section>

      <RoomRemovals roomId={room.id} removals={removals} canReadmit={canRemove} />

      <RoomParticipants participants={participants} canRemove={canRemove} />

      <RoomShares shares={shares} />

      <AdminHistory entries={history} />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
