import { PhoneOutgoing } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useRevalidator, useRouteLoaderData } from "react-router";
import { toast } from "sonner";
import type { loader as rootLoader } from "@/app/root";
import { callFriend, callGroup } from "@/features/ringing/actions";
import {
  savePendingCall,
  usePendingCall,
  type PendingCall,
} from "@/features/ringing/client/pending-call";
import { usePageSlot } from "@/features/ringing/client/use-page-slot";

/** The spot above "Pronto para entrar?" kept free for notices like this one. */
const NOTICE_SLOT_ID = "pre-join-notice";

/** While waiting, the room is checked this often: joining sends no message of its own. */
const CHECK_MS = 3_000;

async function ring(call: PendingCall) {
  const result =
    call.kind === "friend"
      ? await callFriend({ friendId: call.friendId, room: call.room })
      : await callGroup({ conversationId: call.conversationId, room: call.room });
  if (!result.data) toast.error(result.serverError ?? "Não dá para chamar agora.");
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * The call waiting for its caller: shown on the room's page until they are in, rung as soon
 * as they are, and dropped when they leave the room without joining.
 */
export function PendingCallRunner() {
  const pending = usePendingCall();
  const { pathname } = useLocation();
  const { revalidate } = useRevalidator();
  const callRoom = useRouteLoaderData<typeof rootLoader>("root")?.ringing?.callRoom ?? null;
  const onRoom = pending !== null && pathname === `/sala/${pending.room}`;
  const arrived = useRef(false);
  const slot = usePageSlot(NOTICE_SLOT_ID, onRoom);

  useEffect(() => {
    if (onRoom) arrived.current = true;
    if (pending && arrived.current && !onRoom) {
      arrived.current = false;
      savePendingCall(null);
    }
  }, [pending, onRoom]);

  useEffect(() => {
    if (!onRoom) return;
    const timer = window.setInterval(() => void revalidate(), CHECK_MS);
    return () => window.clearInterval(timer);
  }, [onRoom, revalidate]);

  useEffect(() => {
    if (!pending || callRoom !== pending.room) return;
    savePendingCall(null);
    void ring(pending);
  }, [pending, callRoom]);

  if (!onRoom || !slot || callRoom === pending.room) return null;
  const who = pending.kind === "friend" ? firstName(pending.name) : pending.name;
  return createPortal(
    <output className="flex items-center gap-2 rounded-2xl border border-line-strong bg-surface-2 px-3 py-1.5 text-left text-xs sm:px-4 sm:text-sm">
      <PhoneOutgoing className="size-4 shrink-0 text-brand-soft" aria-hidden="true" />
      Vamos chamar {who} quando você entrar
    </output>,
    slot,
  );
}
