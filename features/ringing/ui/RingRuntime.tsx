import { Phone } from "lucide-react";
import { useEffect, useEffectEvent, useRef } from "react";
import { useLocation, useNavigate, useRouteLoaderData } from "react-router";
import { toast } from "sonner";
import type { loader as rootLoader } from "@/app/root";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { Button } from "@/components/ui/button";
import { friendPhotoPath } from "@/features/friends/domain/friend-lists";
import { firstName } from "@/features/messages/domain/conversation-display";
import {
  notify,
  playCallEndSound,
  type NotifyHandle,
} from "@/features/notifications/client/notify";
import { acceptCall, declineCall } from "@/features/ringing/actions";
import { useConnectedCallRoom } from "@/features/ringing/client/call-connection";
import { usePushedRing } from "@/features/ringing/client/pushed-ring";
import { showCallNotice } from "@/features/room/client/call-notices";
import { PendingCallRunner } from "@/features/ringing/ui/PendingCallRunner";
import { RoomRingStatus } from "@/features/ringing/ui/RoomRingStatus";
import {
  ringSoundLeft,
  type IncomingRing,
  type OutgoingRing,
} from "@/features/ringing/domain/ring";

function useAnswer(ring: IncomingRing) {
  const navigate = useNavigate();
  const enter = async () => {
    const result = await acceptCall({ ringId: ring.id });
    if (!result.data) return toast.error(result.serverError ?? "A chamada já acabou.");
    void navigate(result.data.path, { viewTransition: true });
  };
  const decline = () => void declineCall({ ringId: ring.id });
  return { enter, decline };
}

/** Rings with sound and, in the background, a system notification, until answered or quiet. */
function useRingAlert(ring: IncomingRing, answer: ReturnType<typeof useAnswer>) {
  const onAction = useEffectEvent((action: string) => {
    if (action === "recusar") return answer.decline();
    void answer.enter();
  });
  useEffect(() => {
    const handle: NotifyHandle = notify({
      kind: "call",
      title: `${ring.callerName} está te chamando`,
      tag: `toque-${ring.id}`,
      actions: [
        { id: "recusar", label: "Recusar", opensApp: false },
        { id: "entrar", label: "Entrar" },
      ],
      onAction,
    });
    const quiet = window.setTimeout(() => handle.close(), ringSoundLeft(ring, Date.now()));
    return () => {
      window.clearTimeout(quiet);
      handle.close();
    };
  }, [ring]);
}

/** "Bruno está te chamando", right below the top bar on any page (full width on phones). */
function IncomingCard({ ring }: { ring: IncomingRing }) {
  const answer = useAnswer(ring);
  useRingAlert(ring, answer);
  return (
    <section
      role="alertdialog"
      aria-label={`${ring.callerName} está te chamando`}
      className="fixed top-20 right-3 left-3 z-50 flex items-center gap-3 rounded-2xl border border-line-strong bg-surface p-2.5 pl-3 shadow-soft sm:left-auto"
    >
      <InitialsAvatar
        name={ring.callerName}
        source={friendPhotoPath(ring.callerId)}
        className="size-10 shrink-0 bg-brand/15 text-sm font-medium text-brand-soft"
      />
      <p className="min-w-0 flex-1 sm:w-40">
        <span className="block truncate text-sm font-semibold">{ring.callerName}</span>
        <span className="block text-xs text-ink-muted">está te chamando</span>
      </p>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          playCallEndSound("declined");
          answer.decline();
        }}
        className="text-danger"
      >
        Recusar
      </Button>
      <Button size="sm" onClick={() => void answer.enter()}>
        <Phone aria-hidden="true" />
        Entrar
      </Button>
    </section>
  );
}

function showEndNotice(ring: OutgoingRing, inCall: boolean) {
  const id = `toque-${ring.id}`;
  const name = firstName(ring.calleeName);
  // In the call, the room's own pill under the top bar; elsewhere, the app's toast.
  if (inCall)
    return showCallNotice(ring.state === "declined" ? `${name} recusou` : `${name} não atendeu`, {
      id,
    });
  if (ring.state === "declined") return toast(`${name} recusou`, { id });
  toast(ring.calleeName, { description: "Ninguém atendeu", id });
}

/** Whether this page shows the call itself, where notices use the call's toaster. */
function useOnCallPage(): boolean {
  const { pathname } = useLocation();
  const connectedRoom = useConnectedCallRoom();
  return connectedRoom !== null && pathname === `/sala/${connectedRoom}`;
}

/** "Ninguém atendeu" or "Bia recusou", once per ring that ended without an answer. */
function useEndNotices(outgoing: readonly OutgoingRing[]) {
  const shown = useRef(new Set<string>());
  const inCall = useOnCallPage();
  useEffect(() => {
    for (const ring of outgoing) {
      if (ring.state === "ringing" || shown.current.has(ring.id)) continue;
      shown.current.add(ring.id);
      showEndNotice(ring, inCall);
      playCallEndSound("missed");
    }
  }, [outgoing, inCall]);
}

/** Calls for the signed-in person, on every page: the incoming ring and the missed notice. */
export function RingRuntime() {
  const ringing = useRouteLoaderData<typeof rootLoader>("root")?.ringing ?? null;
  useEndNotices(ringing?.outgoing ?? []);
  const pushed = usePushedRing();
  // The loaders decide; the ring that came with the nudge only fills the gap until they reload.
  const incoming = ringing?.incoming[0] ?? pushed;
  if (!ringing) return null;
  return (
    <>
      <PendingCallRunner />
      <RoomRingStatus />
      {incoming ? <IncomingCard key={incoming.id} ring={incoming} /> : null}
    </>
  );
}
